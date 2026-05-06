import { afterEach, describe, expect, it, vi } from 'vitest'
import { RequestRegistry } from './request-registry.js'

afterEach(() => {
  vi.useRealTimers()
})

function never(): Promise<never> {
  return new Promise(() => {})
}

describe('RequestRegistry', () => {
  it('把 signal 交给操作并在结束后注销', async () => {
    const registry = new RequestRegistry()
    let seen: AbortSignal | undefined

    const result = await registry.run({ timeoutMs: 1000 }, (signal) => {
      seen = signal
      return Promise.resolve(42)
    })

    expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(result.value).toBe(42)
    expect(seen?.aborted).toBe(false)
    expect(registry.size).toBe(0)
  })

  it('超时中止 signal 并抛 REQUEST_TIMEOUT', async () => {
    vi.useFakeTimers()
    const registry = new RequestRegistry()
    let signal: AbortSignal | undefined

    const pending = registry.run({ timeoutMs: 100 }, (requestSignal) => {
      signal = requestSignal
      return never()
    })
    const assertion = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' })

    await vi.advanceTimersByTimeAsync(101)

    await assertion
    expect(signal?.aborted).toBe(true)
    expect(registry.size).toBe(0)
  })

  it('cancel 中止指定请求并返回是否命中', async () => {
    const registry = new RequestRegistry()
    const pending = registry.run({ requestId: 'r1', timeoutMs: null }, never)

    expect(registry.cancel('r1')).toBe(true)
    await expect(pending).rejects.toMatchObject({ code: 'REQUEST_ABORTED' })
    expect(registry.cancel('r1')).toBe(false)
  })

  it('cancelByTag 只中止匹配标签的请求', async () => {
    const registry = new RequestRegistry()
    const first = registry.run({ timeoutMs: null, tag: 'stats:s1' }, never)
    const second = registry.run({ timeoutMs: null, tag: 'stats:s2' }, never)

    expect(registry.cancelByTag('stats:s1')).toBe(1)
    await expect(first).rejects.toMatchObject({ code: 'REQUEST_ABORTED' })
    expect(registry.size).toBe(1)

    registry.cancelByTag('stats:s2')
    await expect(second).rejects.toMatchObject({ code: 'REQUEST_ABORTED' })
  })

  it('重复 requestId 直接拒绝', async () => {
    const registry = new RequestRegistry()
    const first = registry.run({ requestId: 'dup', timeoutMs: null }, never)

    await expect(
      registry.run({ requestId: 'dup', timeoutMs: null }, () => Promise.resolve(1)),
    ).rejects.toMatchObject({ code: 'INVALID_CONFIG' })

    registry.cancel('dup')
    await expect(first).rejects.toMatchObject({ code: 'REQUEST_ABORTED' })
  })

  it('timeout 为 null 时不挂定时器', async () => {
    vi.useFakeTimers()
    const registry = new RequestRegistry()
    const pending = registry.run({ requestId: 'r2', timeoutMs: null }, never)

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(registry.size).toBe(1)

    registry.cancel('r2')
    await expect(pending).rejects.toMatchObject({ code: 'REQUEST_ABORTED' })
  })

  it('dispose 中止所有请求并清空表', async () => {
    const registry = new RequestRegistry()
    const first = registry.run({ timeoutMs: null }, never)
    const second = registry.run({ timeoutMs: null }, never)

    registry.dispose()

    await expect(first).rejects.toMatchObject({ code: 'REQUEST_ABORTED' })
    await expect(second).rejects.toMatchObject({ code: 'REQUEST_ABORTED' })
    expect(registry.size).toBe(0)
  })
})
