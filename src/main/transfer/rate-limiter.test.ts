import { describe, expect, it } from 'vitest'
import { TRANSFER_CONFIG } from '@shared/constants/index.js'
import { TransferRateLimiter, type RateLimiterClock } from './rate-limiter.js'

interface VirtualClock {
  clock: RateLimiterClock
  sleeps: number[]
  now(): number
}

/** 虚拟时钟：`sleep` 只记录时长；`advance: false` 模拟多个任务在同一时刻发起。 */
function createVirtualClock(options: { advance?: boolean } = {}): VirtualClock {
  const advance = options.advance ?? true
  let current = 0
  const sleeps: number[] = []
  return {
    clock: {
      now: () => current,
      sleep: (ms) => {
        sleeps.push(ms)
        if (advance) current += ms
        return Promise.resolve()
      },
    },
    sleeps,
    now: () => current,
  }
}

function signalOf(controller: AbortController): AbortSignal {
  return controller.signal
}

describe('TransferRateLimiter', () => {
  it('不限速时立即放行', async () => {
    const virtual = createVirtualClock()
    const limiter = new TransferRateLimiter(virtual.clock)
    limiter.setBytesPerSecond(TRANSFER_CONFIG.DEFAULT_SPEED_LIMIT)

    await limiter.consume(64 * 1024, signalOf(new AbortController()))

    expect(virtual.sleeps).toEqual([])
  })

  it('按字节数换算等待时长，且不抢跑', async () => {
    const virtual = createVirtualClock()
    const limiter = new TransferRateLimiter(virtual.clock)
    limiter.setBytesPerSecond(1000)

    const signal = signalOf(new AbortController())
    await limiter.consume(500, signal)
    await limiter.consume(500, signal)

    expect(virtual.sleeps).toEqual([500, 500])
    expect(virtual.now()).toBe(1000)
  })

  it('并发任务共享同一份配额：后到的任务排队更久', async () => {
    // 同一时刻发起（时钟不走动），三个 500 字节的块必须排在一条时间线上。
    const virtual = createVirtualClock({ advance: false })
    const limiter = new TransferRateLimiter(virtual.clock)
    limiter.setBytesPerSecond(1000)

    const signal = signalOf(new AbortController())
    await Promise.all([
      limiter.consume(500, signal),
      limiter.consume(500, signal),
      limiter.consume(500, signal),
    ])

    expect(virtual.sleeps).toEqual([500, 1000, 1500])
  })

  it('空闲期不累积突发额度', async () => {
    const virtual = createVirtualClock()
    const limiter = new TransferRateLimiter(virtual.clock)
    limiter.setBytesPerSecond(1000)

    const signal = signalOf(new AbortController())
    await limiter.consume(100, signal)
    await limiter.consume(100, signal)

    expect(virtual.sleeps).toEqual([100, 100])
  })

  it('改速率后清空旧预约，新速率立刻生效', async () => {
    const virtual = createVirtualClock()
    const limiter = new TransferRateLimiter(virtual.clock)
    limiter.setBytesPerSecond(100)
    const signal = signalOf(new AbortController())
    await limiter.consume(100, signal)

    limiter.setBytesPerSecond(1000)
    await limiter.consume(1000, signal)

    expect(virtual.sleeps).toEqual([1000, 1000])
  })

  it('把速率夹到 0..MAX_SPEED_LIMIT', () => {
    const limiter = new TransferRateLimiter(createVirtualClock().clock)

    limiter.setBytesPerSecond(-5)
    expect(limiter.bytesPerSecond).toBe(0)

    limiter.setBytesPerSecond(TRANSFER_CONFIG.MAX_SPEED_LIMIT * 4)
    expect(limiter.bytesPerSecond).toBe(TRANSFER_CONFIG.MAX_SPEED_LIMIT)
  })

  it('已经取消的信号不会被放行', async () => {
    const limiter = new TransferRateLimiter(createVirtualClock().clock)
    limiter.setBytesPerSecond(1000)
    const controller = new AbortController()
    controller.abort()

    await expect(limiter.consume(500, controller.signal)).rejects.toBeDefined()
  })
})
