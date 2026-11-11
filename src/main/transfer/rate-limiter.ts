import { TRANSFER_CONFIG } from '@shared/constants/index.js'

/** 可替换时钟：生产用真实时间，测试用虚拟时钟。 */
export interface RateLimiterClock {
  now(): number
  sleep(ms: number, signal: AbortSignal): Promise<void>
}

/** 取消原因可能是任意值，统一收敛成 Error。 */
function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason
  return reason instanceof Error
    ? reason
    : new Error('transfer aborted while waiting for bandwidth')
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(abortError(signal))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    if (signal.aborted) {
      clearTimeout(timer)
      reject(abortError(signal))
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

const DEFAULT_CLOCK: RateLimiterClock = {
  now: () => performance.now(),
  sleep: defaultSleep,
}

/**
 * 一个方向的共享配额：按「块大小 ÷ 速率」预约放行时刻，所有并发任务排在同一条时间线上，
 * 因此拿到的是总带宽而不是各任务一份。空闲时不累积突发额度。
 */
export class TransferRateLimiter {
  private readonly clock: RateLimiterClock
  /** 每毫秒可用字节数；`0` 表示不限速。 */
  private bytesPerMs = 0
  /** 下一次可以把数据交给下游的时刻（与 `clock.now()` 同一时基）。 */
  private nextAvailableAt = 0

  constructor(clock: RateLimiterClock = DEFAULT_CLOCK) {
    this.clock = clock
  }

  get bytesPerSecond(): number {
    return this.bytesPerMs * 1000
  }

  setBytesPerSecond(value: number): void {
    const clamped = Math.min(
      TRANSFER_CONFIG.MAX_SPEED_LIMIT,
      Math.max(TRANSFER_CONFIG.MIN_SPEED_LIMIT, value),
    )
    this.bytesPerMs = clamped / 1000
    // 清空旧预约，否则上一档速率排下的等待会压住新速率。
    this.nextAvailableAt = 0
  }

  /** 预约 `bytes` 字节的配额；等待时长含这块数据自身的传输时间，短传输也不会抢跑。 */
  async consume(bytes: number, signal: AbortSignal): Promise<void> {
    if (this.bytesPerMs <= 0 || bytes <= 0) return
    signal.throwIfAborted()

    const now = this.clock.now()
    const startAt = Math.max(now, this.nextAvailableAt)
    this.nextAvailableAt = startAt + bytes / this.bytesPerMs

    const waitMs = this.nextAvailableAt - now
    if (waitMs < 1) return
    await this.clock.sleep(waitMs, signal)
  }
}
