import { describe, expect, it } from 'vitest'
import { TaskSemaphore } from './semaphore.js'

describe('TaskSemaphore', () => {
  it('容量为 1 时串行启动', async () => {
    const semaphore = new TaskSemaphore(1)
    await semaphore.acquire('a')
    expect(semaphore.activeCount).toBe(1)

    let started = false
    const second = semaphore.acquire('b').then(() => {
      started = true
    })
    await Promise.resolve()
    expect(started).toBe(false)
    expect(semaphore.waitingKeys).toEqual(['b'])

    semaphore.release('a')
    await second
    expect(started).toBe(true)
    expect(semaphore.activeCount).toBe(1)
    expect(semaphore.waitingKeys).toEqual([])
  })

  it('取消等待中的某个 key 不影响其它等待者', async () => {
    const semaphore = new TaskSemaphore(1)
    await semaphore.acquire('a')
    const second = semaphore.acquire('b')
    const third = semaphore.acquire('c')

    expect(semaphore.cancel('b')).toBe(true)
    await expect(second).rejects.toMatchObject({ code: 'REQUEST_ABORTED' })
    expect(semaphore.waitingKeys).toEqual(['c'])
    expect(semaphore.cancel('missing')).toBe(false)

    semaphore.release('a')
    await third
    expect(semaphore.activeCount).toBe(1)
  })

  it('动态增大容量会立即启动等待者', async () => {
    const semaphore = new TaskSemaphore(1)
    await semaphore.acquire('a')
    const second = semaphore.acquire('b')
    const third = semaphore.acquire('c')
    expect(semaphore.waitingKeys).toEqual(['b', 'c'])

    semaphore.setCapacity(3)

    await second
    await third
    expect(semaphore.activeCount).toBe(3)
    expect(semaphore.waitingKeys).toEqual([])
  })

  it('signal 中止会移除等待者', async () => {
    const semaphore = new TaskSemaphore(1)
    await semaphore.acquire('a')
    const controller = new AbortController()
    const second = semaphore.acquire('b', controller.signal)

    controller.abort()

    await expect(second).rejects.toMatchObject({ code: 'REQUEST_ABORTED' })
    expect(semaphore.waitingKeys).toEqual([])

    semaphore.release('a')
    expect(semaphore.activeCount).toBe(0)
  })

  it('release 未知 key 不影响 active 计数', () => {
    const semaphore = new TaskSemaphore(2)
    semaphore.release('missing')
    expect(semaphore.activeCount).toBe(0)
  })
})
