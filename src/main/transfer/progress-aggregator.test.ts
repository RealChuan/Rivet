import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TransferProgressData } from '@shared/types/transfer.js'
import { ProgressAggregator } from './progress-aggregator.js'

function data(taskId: string, transferredSize: number): TransferProgressData {
  return { taskId, transferredSize }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ProgressAggregator', () => {
  it('同一 task 在窗口内只保留最后一条快照', async () => {
    vi.useFakeTimers()
    const batches: TransferProgressData[][] = []
    const aggregator = new ProgressAggregator({
      flushMs: 200,
      send: (batch) => batches.push(batch),
    })

    aggregator.update(data('t1', 100))
    aggregator.update(data('t2', 50))
    aggregator.update(data('t1', 500))

    expect(aggregator.pendingCount).toBe(2)
    await vi.advanceTimersByTimeAsync(199)
    expect(batches).toEqual([])

    await vi.advanceTimersByTimeAsync(1)
    expect(batches).toHaveLength(1)
    expect(batches[0]).toEqual([data('t1', 500), data('t2', 50)])
    expect(aggregator.pendingCount).toBe(0)
  })

  it('flush 立即发送并清空 pending', () => {
    const batches: TransferProgressData[][] = []
    const aggregator = new ProgressAggregator({
      flushMs: 200,
      send: (batch) => batches.push(batch),
    })

    aggregator.update(data('t1', 100))
    aggregator.flush()

    expect(batches).toEqual([[data('t1', 100)]])
    expect(aggregator.pendingCount).toBe(0)

    aggregator.flush()
    expect(batches).toHaveLength(1)
  })

  it('按采样间隔算出字节速度，附在快照上', () => {
    vi.useFakeTimers()
    const batches: TransferProgressData[][] = []
    const aggregator = new ProgressAggregator({
      flushMs: 200,
      send: (batch) => batches.push(batch),
    })

    aggregator.update(data('t1', 0))
    vi.advanceTimersByTime(1000)
    aggregator.update(data('t1', 2_000_000))
    aggregator.flush()

    expect(batches.at(-1)?.[0]).toMatchObject({ transferredSize: 2_000_000, speed: 2_000_000 })
  })

  it('同一时刻的两次上报不产生速度', () => {
    vi.useFakeTimers()
    const batches: TransferProgressData[][] = []
    const aggregator = new ProgressAggregator({
      flushMs: 200,
      send: (batch) => batches.push(batch),
    })

    aggregator.update(data('t1', 0))
    aggregator.update(data('t1', 1000))
    aggregator.flush()

    expect(batches.at(-1)?.[0]?.speed).toBeUndefined()
  })

  it('dispose 清定时器，之后不再发送', async () => {
    vi.useFakeTimers()
    const batches: TransferProgressData[][] = []
    const aggregator = new ProgressAggregator({
      flushMs: 200,
      send: (batch) => batches.push(batch),
    })

    aggregator.update(data('t1', 100))
    aggregator.dispose()

    await vi.advanceTimersByTimeAsync(1000)
    expect(batches).toEqual([])
    expect(aggregator.pendingCount).toBe(0)
  })
})
