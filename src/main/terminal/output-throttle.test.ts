import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputThrottle } from './output-throttle.js'

const MAX_CHUNK_BYTES = 64 * 1024

function createThrottle() {
  const send = vi.fn()
  const onBackpressure = vi.fn()
  const throttle = new OutputThrottle({ flushMs: 16, send, onBackpressure })
  return { throttle, send, onBackpressure }
}

describe('OutputThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('窗口内的多个小块合并成一次发送', () => {
    const { throttle, send } = createThrottle()
    throttle.push(Buffer.from('ab'))
    throttle.push(Buffer.from('cd'))

    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(16)
    expect(send).toHaveBeenCalledTimes(1)
    expect(Buffer.from(send.mock.calls[0]?.[0] as Uint8Array).toString()).toBe('abcd')
  })

  it('达到单帧上限时立即切块发送，剩余留待下一帧', () => {
    const { throttle, send } = createThrottle()
    throttle.push(Buffer.alloc(MAX_CHUNK_BYTES + 100))

    expect(send).toHaveBeenCalledTimes(1)
    expect((send.mock.calls[0]?.[0] as Uint8Array).length).toBe(MAX_CHUNK_BYTES)
    expect(throttle.pendingBytes).toBe(100)

    vi.advanceTimersByTime(16)
    expect(send).toHaveBeenCalledTimes(2)
    expect(throttle.pendingBytes).toBe(0)
  })

  it('积压超限时通知上游暂停，排空后恢复', () => {
    const { throttle, send, onBackpressure } = createThrottle()
    throttle.push(Buffer.alloc(1024 * 1024 + 1))

    expect(onBackpressure).toHaveBeenCalledWith(true)

    for (let i = 0; i < 20; i += 1) {
      throttle.flush()
    }
    expect(onBackpressure).toHaveBeenLastCalledWith(false)
    expect(send.mock.calls.length).toBeGreaterThan(1)
  })

  it('发送内容与输入逐字节一致，多字节字符不被拆坏', () => {
    const { throttle, send } = createThrottle()
    const input = Buffer.concat([Buffer.from('中文'), Buffer.alloc(MAX_CHUNK_BYTES, 0x41)])
    throttle.push(input)
    throttle.flush()

    const joined = Buffer.concat(send.mock.calls.map((call) => Buffer.from(call[0] as Uint8Array)))
    expect(joined.equals(input)).toBe(true)
  })

  it('dispose 后不再发送', () => {
    const { throttle, send } = createThrottle()
    throttle.push(Buffer.from('ab'))
    throttle.dispose()
    vi.advanceTimersByTime(100)
    expect(send).not.toHaveBeenCalled()
  })
})
