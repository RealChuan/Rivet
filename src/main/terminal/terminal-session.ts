import type { Credentials } from '@shared/domain/credentials.js'
import type { AppError, ErrorCode } from '@shared/domain/error.js'
import type { ConnectionConfig, TerminalExitInfo } from '@shared/types/index.js'
import { ERROR_CODE, TIMEOUTS } from '@shared/constants/index.js'
import { toAppError } from '@shared/domain/error.js'
import { ProviderError } from '../providers/errors.js'
import { buildSshAuthConfig, mapSshAuthError } from '../providers/sftp/auth.js'
import { parseHostPublicKey } from '../providers/sftp/host-key.js'
import { getKnownHost } from '../stores/known-hosts.js'
import { OutputThrottle } from './output-throttle.js'
import { shellQuote } from './shell-quote.js'

const TERMINAL_TYPE = 'xterm-256color'

/** ssh2 拒绝 shell 时的错误文案没有稳定错误码，只能按语义匹配。 */
const SHELL_REJECTED_PATTERN = /shell|pty|prohibited|not allowed|administratively|denied/i

/** ssh2 的 shell 通道，收窄到终端用到的调用面。 */
export interface Ssh2ShellStreamPort {
  on(event: 'data', listener: (chunk: Buffer) => void): void
  on(event: 'close', listener: () => void): void
  on(event: 'error', listener: (error: Error) => void): void
  write(data: Buffer): void
  /** ssh2 还带 height/width，终端只用到行列。 */
  setWindow(rows: number, cols: number, height?: number, width?: number): void
  pause(): void
  resume(): void
  close(): void
}

export interface ShellWindow {
  term: string
  cols: number
  rows: number
}

/** ssh2 的 `ShellOptions`：终端不用环境变量，留空占位。 */
export type ShellOptions = Record<string, unknown>

export interface Ssh2ShellClientPort {
  on(event: 'ready', listener: () => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
  removeListener(event: 'ready', listener: () => void): unknown
  removeListener(event: 'error', listener: (error: Error) => void): unknown
  connect(options: Record<string, unknown>): void
  end(): void
  /** 三参形态与 ssh2 的首个重载对齐，避免结构比较落到参数个数上。 */
  shell(window: ShellWindow, options: ShellOptions, callback: ShellCallback): unknown
}

export type ShellCallback = (error: Error | undefined, stream: Ssh2ShellStreamPort) => void

export interface TerminalSessionDeps {
  createClient: () => Ssh2ShellClientPort
  onData: (terminalId: string, chunk: Uint8Array) => void
  onExit: (info: TerminalExitInfo) => void
}

export interface OpenTerminalShellRequest {
  cols: number
  rows: number
  cwd?: string | undefined
}

/** 服务器不允许 shell 归为不可用，其余视为打开失败。 */
export function mapShellError(error: Error): ErrorCode {
  return SHELL_REJECTED_PATTERN.test(error.message)
    ? ERROR_CODE.TERMINAL_UNAVAILABLE
    : ERROR_CODE.TERMINAL_OPEN_FAILED
}

/**
 * 文件会话已连通过，known-hosts 必有该主机：对不上就是环境变了，
 * 不再走两阶段确认，直接失败。
 */
function createStrictHostVerifier(config: ConnectionConfig): (publicKey: Buffer) => boolean {
  return (publicKey) => {
    try {
      const parsed = parseHostPublicKey(publicKey)
      const known = getKnownHost(config.host, config.port, parsed.algorithm)
      if (!known.success || !known.value) return false
      return known.value.fingerprint === parsed.fingerprint
    } catch {
      return false
    }
  }
}

/**
 * 一个终端 = 一条独立 SSH 连接上的 shell 通道，不与文件会话共用 ssh2.Client。
 */
export class TerminalSession {
  private readonly id: string
  private readonly config: ConnectionConfig
  private readonly credentials: Credentials
  private readonly deps: TerminalSessionDeps
  private client: Ssh2ShellClientPort | undefined
  private stream: Ssh2ShellStreamPort | undefined
  private throttle: OutputThrottle | undefined
  private closed = false

  constructor(
    id: string,
    config: ConnectionConfig,
    credentials: Credentials,
    deps: TerminalSessionDeps,
  ) {
    this.id = id
    this.config = config
    this.credentials = credentials
    this.deps = deps
  }

  get isOpen(): boolean {
    return this.stream !== undefined && !this.closed
  }

  async open(request: OpenTerminalShellRequest): Promise<void> {
    const auth = await buildSshAuthConfig(this.credentials)
    const client = this.deps.createClient()
    this.client = client

    const connectOptions: Record<string, unknown> = {
      host: this.config.host,
      port: this.config.port,
      username: auth.username,
      ...(auth.password !== undefined ? { password: auth.password } : {}),
      ...(auth.privateKey !== undefined ? { privateKey: auth.privateKey } : {}),
      ...(auth.passphrase !== undefined ? { passphrase: auth.passphrase } : {}),
      ...(auth.agent !== undefined ? { agent: auth.agent } : {}),
      readyTimeout: auth.readyTimeout,
      hostVerifier: createStrictHostVerifier(this.config),
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const onReady = (): void => {
          cleanup()
          resolve()
        }
        const onError = (error: Error): void => {
          cleanup()
          const mapped = mapSshAuthError(error, this.credentials.kind)
          reject(new ProviderError(mapped.code, mapped.message, mapped.detail))
        }
        const cleanup = (): void => {
          client.removeListener('ready', onReady)
          client.removeListener('error', onError)
        }

        client.on('ready', onReady)
        client.on('error', onError)
        client.connect(connectOptions)
      })

      const stream = await new Promise<Ssh2ShellStreamPort>((resolve, reject) => {
        client.shell(
          { term: TERMINAL_TYPE, cols: request.cols, rows: request.rows },
          {},
          (error, opened) => {
            if (error) {
              reject(
                new ProviderError(mapShellError(error), error.message, {
                  serverMessage: error.message,
                }),
              )
              return
            }
            resolve(opened)
          },
        )
      })

      this.stream = stream
      this.attach(stream)

      const cwd = request.cwd
      if (cwd !== undefined && cwd !== '') {
        stream.write(Buffer.from(`cd -- ${shellQuote(cwd)}\n`))
      }
    } catch (error) {
      this.closed = true
      this.stream = undefined
      this.client = undefined
      client.end()
      throw error
    }
  }

  write(data: Uint8Array): void {
    if (this.closed || !this.stream) return
    this.stream.write(Buffer.from(data))
  }

  resize(cols: number, rows: number): void {
    // ssh2 的参数顺序是 (rows, cols)，写反会让全屏程序错位。
    this.stream?.setWindow(rows, cols)
  }

  close(): Promise<void> {
    if (this.closed) return Promise.resolve()
    this.closed = true

    this.throttle?.flush()
    this.throttle?.dispose()
    this.throttle = undefined

    const stream = this.stream
    this.stream = undefined
    stream?.close()

    const client = this.client
    this.client = undefined
    client?.end()

    this.deps.onExit({ terminalId: this.id, reason: 'closed' })
    return Promise.resolve()
  }

  private attach(stream: Ssh2ShellStreamPort): void {
    const throttle = new OutputThrottle({
      flushMs: TIMEOUTS.TERMINAL_FLUSH_MS,
      send: (data) => {
        this.deps.onData(this.id, data)
      },
      onBackpressure: (paused) => {
        if (paused) stream.pause()
        else stream.resume()
      },
    })
    this.throttle = throttle

    stream.on('data', (chunk) => {
      throttle.push(chunk)
    })
    stream.on('error', (error) => {
      this.finish({ reason: 'error', error: toAppError(error, ERROR_CODE.TERMINAL_OPEN_FAILED) })
    })
    stream.on('close', () => {
      this.finish({ reason: 'exited' })
    })
  }

  /** 远端结束：先把攒着的输出冲出去，再通知渲染层。 */
  private finish(patch: { reason: 'exited' | 'error'; error?: AppError }): void {
    if (this.closed) return
    this.closed = true

    this.throttle?.flush()
    this.throttle?.dispose()
    this.throttle = undefined
    this.stream = undefined
    this.client?.end()
    this.client = undefined

    this.deps.onExit({ terminalId: this.id, ...patch })
  }
}
