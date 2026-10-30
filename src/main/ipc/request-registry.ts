import crypto from 'node:crypto'
import type { ErrorCode } from '@shared/domain/error.js'
import { ERROR_CODE } from '@shared/constants/index.js'

export interface RequestOptions {
  requestId?: string
  /** `null` 表示只受显式取消约束（长任务）。 */
  timeoutMs: number | null
  tag?: string
}

export interface TrackedResult<T> {
  requestId: string
  value: T
}

interface Entry {
  controller: AbortController
  tag: string | undefined
  reason: ErrorCode
  timer: NodeJS.Timeout | undefined
}

export class RequestError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode) {
    super(code)
    this.name = 'RequestError'
    this.code = code
  }
}

function abortError(code: ErrorCode): RequestError {
  return new RequestError(code)
}

/**
 * 取消与超时的唯一所有者。
 * 除了 `run` 的 finally，没有第二处会清理请求；`PROTOCOL.CANCEL` 只查这一张表。
 */
export class RequestRegistry {
  private entries = new Map<string, Entry>()

  get size(): number {
    return this.entries.size
  }

  async run<T>(
    options: RequestOptions,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<TrackedResult<T>> {
    const requestId = options.requestId ?? crypto.randomUUID()
    if (this.entries.has(requestId)) {
      throw new RequestError(ERROR_CODE.INVALID_CONFIG)
    }

    const controller = new AbortController()
    const entry: Entry = {
      controller,
      tag: options.tag,
      reason: ERROR_CODE.REQUEST_ABORTED,
      timer: undefined,
    }

    if (options.timeoutMs !== null) {
      entry.timer = setTimeout(() => {
        entry.reason = ERROR_CODE.REQUEST_TIMEOUT
        controller.abort()
      }, options.timeoutMs)
    }

    this.entries.set(requestId, entry)

    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(abortError(entry.reason)), {
        once: true,
      })
    })
    // 让 aborted 自身始终带一个处理器，避免竞速已结束后迟到的 abort 变成 unhandled rejection。
    void aborted.catch(() => {})

    try {
      const value = await Promise.race([operation(controller.signal), aborted])
      return { requestId, value }
    } finally {
      if (entry.timer !== undefined) clearTimeout(entry.timer)
      this.entries.delete(requestId)
    }
  }

  cancel(requestId: string): boolean {
    const entry = this.entries.get(requestId)
    if (!entry) return false
    entry.reason = ERROR_CODE.REQUEST_ABORTED
    entry.controller.abort()
    return true
  }

  cancelByTag(tag: string): number {
    let cancelled = 0
    for (const entry of this.entries.values()) {
      if (entry.tag !== tag) continue
      entry.reason = ERROR_CODE.REQUEST_ABORTED
      entry.controller.abort()
      cancelled++
    }
    return cancelled
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      if (entry.timer !== undefined) clearTimeout(entry.timer)
      entry.reason = ERROR_CODE.REQUEST_ABORTED
      entry.controller.abort()
    }
    this.entries.clear()
  }
}

export const requestRegistry = new RequestRegistry()
