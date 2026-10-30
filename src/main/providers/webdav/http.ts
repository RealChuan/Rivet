import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import { Agent, request as undiciRequest, type Dispatcher } from 'undici'
import type { ErrorCode } from '@shared/domain/error.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import { logger } from '../../utils/logger.js'
import { ProviderError } from '../errors.js'
import {
  buildBasicAuthorization,
  buildDigestAuthorization,
  parseDigestChallenge,
  type DigestChallenge,
} from './auth.js'
import { HTTP_STATUS, isHttpSuccess } from './http-status.js'

export interface WebdavHttpOptions {
  baseUrl: string
  username: string
  password: string
  rejectUnauthorized: boolean
}

export interface WebdavHttpRequestOptions {
  headers?: Record<string, string>
  body?: Readable | Uint8Array | string
  signal?: AbortSignal
}

export interface WebdavHttpResponse {
  status: number
  headers: Record<string, string>
  body: ReadableStream<Uint8Array>
  text: () => Promise<string>
}

export interface WebdavHttpPort {
  request(
    method: string,
    path: string,
    opts?: WebdavHttpRequestOptions,
  ): Promise<WebdavHttpResponse>
  close(): Promise<void>
}

export type DispatcherFactory = (options: {
  connect: { rejectUnauthorized: boolean }
}) => Dispatcher

interface WebdavHttpDeps {
  request?: typeof undiciRequest
  createDispatcher?: DispatcherFactory
  random?: () => string
}

export function createDispatcher(
  rejectUnauthorized: boolean,
  factory: DispatcherFactory = (options) => new Agent(options),
): Dispatcher {
  return factory({ connect: { rejectUnauthorized } })
}

/** 路径逐段编码；`%` 也会被编码，避免把文件名里的半截转义当成已编码序列。 */
export function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      try {
        return encodeURIComponent(segment)
      } catch {
        throw new ProviderError(
          ERROR_CODE.PATH_ERROR,
          'WebDAV path contains characters that cannot be URL-encoded',
        )
      }
    })
    .join('/')
}

/** 请求行里的 request-target；Digest 的 uri 必须与它逐字节一致。 */
function requestTarget(path: string): string {
  const prefix = path.startsWith('/') ? '' : '/'
  return `${prefix}${encodePath(path)}`
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  return `${base}${requestTarget(path)}`
}

/** 非 2xx 响应必须排空，否则连接无法复用，流式上传还会一直往内存里缓冲。 */
async function discard(response: WebdavHttpResponse): Promise<void> {
  await response.body.cancel().catch(() => {})
}

/** 完整读取错误正文；长度问题交给日志滚动/归档处理，业务层不截断诊断信息。 */
async function readServerMessage(response: WebdavHttpResponse): Promise<string | undefined> {
  let raw: string
  try {
    raw = await response.text()
  } catch {
    // 错误正文不可读时仍按状态码报错。
    return undefined
  } finally {
    await response.body.cancel().catch(() => {})
  }

  const cleaned = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > 0 ? cleaned : undefined
}

function statusError(status: number, serverMessage?: string): ProviderError {
  const code: ErrorCode =
    status === HTTP_STATUS.UNAUTHORIZED
      ? ERROR_CODE.AUTH_ERROR
      : status === HTTP_STATUS.FORBIDDEN
        ? ERROR_CODE.PERMISSION_DENIED
        : status === HTTP_STATUS.NOT_FOUND
          ? ERROR_CODE.NOT_FOUND
          : status === HTTP_STATUS.METHOD_NOT_ALLOWED
            ? ERROR_CODE.NOT_SUPPORTED
            : status === HTTP_STATUS.CONFLICT
              ? ERROR_CODE.ALREADY_EXISTS
              : ERROR_CODE.CONN_FAILED
  const message = `WebDAV request failed with status ${status}${serverMessage ? `: ${serverMessage}` : ''}`
  return new ProviderError(
    code,
    message,
    serverMessage !== undefined ? { serverMessage } : undefined,
  )
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue
    result[key] = Array.isArray(value) ? value.join(', ') : value
  }
  return result
}

/**
 * 只做 HTTP：Basic 预置、401 Digest challenge 时缓存并重试一次。
 * 基于 undici 是为了注入 dispatcher 关闭自签证书校验。
 */
export class WebdavHttpClient implements WebdavHttpPort {
  private readonly options: WebdavHttpOptions
  private readonly requestFn: typeof undiciRequest
  private readonly random: () => string
  private readonly dispatcher: Dispatcher
  private digest: DigestChallenge | null = null
  private nonceCount = 0

  constructor(options: WebdavHttpOptions, deps: WebdavHttpDeps = {}) {
    this.options = options
    this.requestFn = deps.request ?? undiciRequest
    this.random = deps.random ?? (() => crypto.randomUUID().replace(/-/g, ''))
    this.dispatcher = createDispatcher(options.rejectUnauthorized, deps.createDispatcher)
  }

  private authorization(method: string, path: string): string {
    if (!this.digest) {
      return buildBasicAuthorization(this.options.username, this.options.password)
    }

    this.nonceCount += 1
    const nc = this.nonceCount.toString(16).padStart(8, '0')
    const cnonce = this.random()

    return buildDigestAuthorization(this.digest, {
      method,
      // Digest 计算必须使用请求行里的编码后路径，否则含空格/非 ASCII 的文件名会被服务端判 401。
      uri: requestTarget(path),
      username: this.options.username,
      password: this.options.password,
      nc,
      cnonce,
    })
  }

  private async send(
    method: string,
    path: string,
    body: WebdavHttpRequestOptions['body'],
    signal: AbortSignal | undefined,
    headers: Record<string, string>,
  ): Promise<WebdavHttpResponse> {
    const controller = new AbortController()
    const onAbort = (): void => controller.abort(signal?.reason)
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) controller.abort(signal.reason)

    let url: string
    try {
      url = joinUrl(this.options.baseUrl, path)
    } catch (error) {
      throw error instanceof ProviderError
        ? error
        : new ProviderError(ERROR_CODE.PATH_ERROR, formatErrorMessage(error))
    }

    try {
      const response = await this.requestFn(url, {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
        signal: controller.signal,
        dispatcher: this.dispatcher,
      })

      const webBody = Readable.toWeb(response.body) as ReadableStream<Uint8Array>

      return {
        status: response.statusCode,
        headers: normalizeHeaders(response.headers),
        body: webBody,
        text: () => new Response(webBody).text(),
      }
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        throw new ProviderError(ERROR_CODE.REQUEST_ABORTED, 'WebDAV request aborted')
      }
      logger.catch(error, { action: 'webdav-request', method, url })
      throw error instanceof ProviderError
        ? error
        : new ProviderError(ERROR_CODE.CONN_FAILED, formatErrorMessage(error))
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
  }

  async request(
    method: string,
    path: string,
    opts: WebdavHttpRequestOptions = {},
  ): Promise<WebdavHttpResponse> {
    const headers: Record<string, string> = {
      ...opts.headers,
      authorization: this.authorization(method, path),
    }

    let response = await this.send(method, path, opts.body, opts.signal, headers)

    if (response.status === HTTP_STATUS.UNAUTHORIZED && !this.digest) {
      const challenge = parseDigestChallenge(response.headers['www-authenticate'] ?? '')
      if (challenge && !(opts.body instanceof Readable)) {
        await discard(response)
        this.digest = challenge
        headers.authorization = this.authorization(method, path)
        response = await this.send(method, path, opts.body, opts.signal, headers)
      }
    }

    if (!isHttpSuccess(response.status)) {
      const serverMessage = await readServerMessage(response)
      logger.warn('WebDAV request failed', {
        method,
        url: requestTarget(path),
        status: response.status,
        serverMessage,
      })
      throw statusError(response.status, serverMessage)
    }

    return response
  }

  async close(): Promise<void> {
    await this.dispatcher.close()
  }
}
