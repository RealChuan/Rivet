import { unwrap } from './result.js'

export const configApi = {
  /**
   * 读取配置。契约侧是 `z.unknown()`，调用方必须用形状守卫确认 `T`。
   * `null` 表示键不存在，与失败区分。
   */
  get: async <T>(key: string): Promise<T | null> => {
    const value = unwrap(await window.electronAPI.config.get(key))
    return value === null ? null : (value as T)
  },

  set: async (key: string, value: unknown): Promise<void> => {
    unwrap(await window.electronAPI.config.set(key, value))
  },
}
