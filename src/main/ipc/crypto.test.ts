/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- 从 vi.fn() mock 提取 handler 时类型为 any */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- 调用从 mock 提取的 handler 时参数为 any */
/* eslint-disable @typescript-eslint/no-explicit-any -- mock.calls 元素类型为 any[] */
import { ipcMain } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/constants/index.js', () => ({
  IPC_CHANNELS: {
    CRYPTO: {
      ENCRYPT_PASSWORD: 'crypto:encrypt-password',
      DECRYPT_PASSWORD: 'crypto:decrypt-password',
    },
  },
}))

vi.mock('../utils/encryption.js', () => ({
  encryptPassword: vi.fn((password: string) => `encrypted:${password}`),
  decryptPassword: vi.fn((encrypted: string) => encrypted.replace('encrypted:', '')),
}))

describe('IPC crypto handlers', () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear()
  })

  describe('setupCryptoIpcHandlers', () => {
    it('should register encrypt password handler', async () => {
      const { setupCryptoIpcHandlers } = await import('./crypto.js')
      const { IPC_CHANNELS } = await import('@shared/constants/index.js')

      setupCryptoIpcHandlers()

      expect(ipcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.CRYPTO.ENCRYPT_PASSWORD,
        expect.any(Function)
      )
    })

    it('should register decrypt password handler', async () => {
      const { setupCryptoIpcHandlers } = await import('./crypto.js')
      const { IPC_CHANNELS } = await import('@shared/constants/index.js')

      setupCryptoIpcHandlers()

      expect(ipcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.CRYPTO.DECRYPT_PASSWORD,
        expect.any(Function)
      )
    })

    it('should call encryptPassword when encrypt handler is invoked', async () => {
      const { setupCryptoIpcHandlers } = await import('./crypto.js')
      const { encryptPassword } = await import('../utils/encryption.js')

      setupCryptoIpcHandlers()

      const encryptHandler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call: any[]) => call[0] === 'crypto:encrypt-password')?.[1]

      if (encryptHandler) {
        const result = await encryptHandler(undefined as any, 'my-password')

        expect(encryptPassword).toHaveBeenCalledWith('my-password')
        expect(result).toBe('encrypted:my-password')
      }
    })

    it('should call decryptPassword when decrypt handler is invoked', async () => {
      const { setupCryptoIpcHandlers } = await import('./crypto.js')
      const { decryptPassword } = await import('../utils/encryption.js')

      setupCryptoIpcHandlers()

      const decryptHandler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call: any[]) => call[0] === 'crypto:decrypt-password')?.[1]

      if (decryptHandler) {
        const result = await decryptHandler(undefined as any, 'encrypted:my-password')

        expect(decryptPassword).toHaveBeenCalledWith('encrypted:my-password')
        expect(result).toBe('my-password')
      }
    })

    it('should register exactly two handlers', async () => {
      const { setupCryptoIpcHandlers } = await import('./crypto.js')

      setupCryptoIpcHandlers()

      expect(ipcMain.handle).toHaveBeenCalledTimes(2)
    })
  })
})
