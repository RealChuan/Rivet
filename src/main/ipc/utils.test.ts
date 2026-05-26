/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- 从 vi.fn() mock 提取 handler 时类型为 any */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- 调用从 mock 提取的 handler 时参数为 any */
/* eslint-disable @typescript-eslint/no-explicit-any -- mock.calls 元素类型为 any[] */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'

vi.mock('@shared/constants/index.js', () => ({
  IPC_CHANNELS: {
    UTILS: {
      ENCRYPT_PASSWORD: 'utils:encrypt-password',
      DECRYPT_PASSWORD: 'utils:decrypt-password',
    },
  },
}))

vi.mock('../utils/encryption.js', () => ({
  encryptPassword: vi.fn((password: string) => `encrypted:${password}`),
  decryptPassword: vi.fn((encrypted: string) => encrypted.replace('encrypted:', '')),
}))

describe('IPC utils handlers', () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear()
  })

  describe('setupUtilsIpcHandlers', () => {
    it('should register encrypt password handler', async () => {
      const { setupUtilsIpcHandlers } = await import('./utils.js')
      const { IPC_CHANNELS } = await import('@shared/constants/index.js')

      setupUtilsIpcHandlers()

      expect(ipcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.UTILS.ENCRYPT_PASSWORD,
        expect.any(Function)
      )
    })

    it('should register decrypt password handler', async () => {
      const { setupUtilsIpcHandlers } = await import('./utils.js')
      const { IPC_CHANNELS } = await import('@shared/constants/index.js')

      setupUtilsIpcHandlers()

      expect(ipcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.UTILS.DECRYPT_PASSWORD,
        expect.any(Function)
      )
    })

    it('should call encryptPassword when encrypt handler is invoked', async () => {
      const { setupUtilsIpcHandlers } = await import('./utils.js')
      const { encryptPassword } = await import('../utils/encryption.js')

      setupUtilsIpcHandlers()

      const encryptHandler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call: any[]) => call[0] === 'utils:encrypt-password')?.[1]

      if (encryptHandler) {
        const result = await encryptHandler(undefined as any, 'my-password')

        expect(encryptPassword).toHaveBeenCalledWith('my-password')
        expect(result).toBe('encrypted:my-password')
      }
    })

    it('should call decryptPassword when decrypt handler is invoked', async () => {
      const { setupUtilsIpcHandlers } = await import('./utils.js')
      const { decryptPassword } = await import('../utils/encryption.js')

      setupUtilsIpcHandlers()

      const decryptHandler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call: any[]) => call[0] === 'utils:decrypt-password')?.[1]

      if (decryptHandler) {
        const result = await decryptHandler(undefined as any, 'encrypted:my-password')

        expect(decryptPassword).toHaveBeenCalledWith('encrypted:my-password')
        expect(result).toBe('my-password')
      }
    })

    it('should register exactly two handlers', async () => {
      const { setupUtilsIpcHandlers } = await import('./utils.js')

      setupUtilsIpcHandlers()

      expect(ipcMain.handle).toHaveBeenCalledTimes(2)
    })
  })
})
