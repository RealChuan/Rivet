import { ERROR_CODE } from '@shared/constants/index.js'
import { RequestError } from '../ipc/request-registry.js'

interface Waiter {
  key: string
  resolve: () => void
  reject: (error: RequestError) => void
  signal: AbortSignal | undefined
  onAbort: (() => void) | undefined
}

/**
 * 按方向共享的并发槽。key 是 taskId 或 folder op id，
 * 取消只影响指定 key，不需要遍历整张任务表。
 */
export class TaskSemaphore {
  private capacity: number
  private readonly active = new Set<string>()
  private waiters: Waiter[] = []

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity)
  }

  get activeCount(): number {
    return this.active.size
  }

  get waitingKeys(): readonly string[] {
    return this.waiters.map((waiter) => waiter.key)
  }

  acquire(key: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      return Promise.reject(new RequestError(ERROR_CODE.REQUEST_ABORTED))
    }

    if (this.active.size < this.capacity) {
      this.active.add(key)
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        key,
        resolve,
        reject,
        signal,
        onAbort: undefined,
      }

      if (signal) {
        waiter.onAbort = (): void => {
          this.removeWaiter(waiter)
          reject(new RequestError(ERROR_CODE.REQUEST_ABORTED))
        }
        signal.addEventListener('abort', waiter.onAbort, { once: true })
      }

      this.waiters.push(waiter)
    })
  }

  release(key: string): void {
    if (this.active.delete(key)) {
      this.drain()
    }
  }

  cancel(key: string): boolean {
    const index = this.waiters.findIndex((waiter) => waiter.key === key)
    if (index === -1) return false

    const [waiter] = this.waiters.splice(index, 1)
    if (!waiter) return false
    this.cleanup(waiter)
    waiter.reject(new RequestError(ERROR_CODE.REQUEST_ABORTED))
    return true
  }

  setCapacity(value: number): void {
    this.capacity = Math.max(1, value)
    this.drain()
  }

  private removeWaiter(waiter: Waiter): void {
    const index = this.waiters.indexOf(waiter)
    if (index === -1) return
    this.waiters.splice(index, 1)
    this.cleanup(waiter)
  }

  private cleanup(waiter: Waiter): void {
    if (waiter.signal && waiter.onAbort) {
      waiter.signal.removeEventListener('abort', waiter.onAbort)
    }
  }

  private drain(): void {
    while (this.active.size < this.capacity && this.waiters.length > 0) {
      const waiter = this.waiters.shift()
      if (!waiter) return
      this.cleanup(waiter)
      this.active.add(waiter.key)
      waiter.resolve()
    }
  }
}
