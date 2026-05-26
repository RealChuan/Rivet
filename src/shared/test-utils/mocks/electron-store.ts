import { vi } from 'vitest'

class MockStore<T extends Record<string, unknown>> {
  private data: T

  constructor(options: { defaults?: T; name?: string } = {}) {
    this.data = { ...options.defaults } as T
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key]
  }

  set<K extends keyof T>(key: K | [K, T[K]][], value?: T[K]): void {
    if (Array.isArray(key)) {
      key.forEach(([k, v]) => {
        this.data[k] = v
      })
    } else {
      this.data[key] = value as T[K]
    }
  }

  delete(key: keyof T): void {
    delete this.data[key]
  }

  clear(): void {
    this.data = {} as T
  }

  onDidChange(): () => void {
    return vi.fn()
  }
}

export default MockStore
