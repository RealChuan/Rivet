/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { safeStorage } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decryptSecret, encryptSecret, isSecretStorageAvailable } from './secrets.js'

describe('secrets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(safeStorage.isAsyncEncryptionAvailable).mockResolvedValue(true)
    vi.mocked(safeStorage.encryptStringAsync).mockResolvedValue(Buffer.from('cipher'))
    vi.mocked(safeStorage.decryptStringAsync).mockResolvedValue({
      result: 'plain',
      shouldReEncrypt: false,
    })
  })

  it('encrypts to v1:<base64> and decrypts back', async () => {
    const encrypted = await encryptSecret('plain')

    expect(encrypted).toBe(`v1:${Buffer.from('cipher').toString('base64')}`)
    expect(await decryptSecret(encrypted ?? '')).toEqual({
      success: true,
      value: 'plain',
      error: null,
    })
  })

  it('decrypts again when the key was rotated', async () => {
    vi.mocked(safeStorage.decryptStringAsync)
      .mockResolvedValueOnce({ result: 'stale', shouldReEncrypt: true })
      .mockResolvedValueOnce({ result: 'fresh', shouldReEncrypt: false })

    const result = await decryptSecret(`v1:${Buffer.from('cipher').toString('base64')}`)

    expect(result).toEqual({ success: true, value: 'fresh', error: null })
    expect(safeStorage.decryptStringAsync).toHaveBeenCalledTimes(2)
  })

  it('returns null when safeStorage is unavailable', async () => {
    vi.mocked(safeStorage.isAsyncEncryptionAvailable).mockResolvedValue(false)

    expect(await isSecretStorageAvailable()).toBe(false)
    expect(await encryptSecret('plain')).toBeNull()
  })

  it('rejects legacy safe: values and missing availability', async () => {
    const legacy = await decryptSecret('safe:abc')
    expect(legacy.success).toBe(false)
    if (!legacy.success) expect(legacy.error.code).toBe('DECRYPT_FORMAT_ERROR')

    vi.mocked(safeStorage.isAsyncEncryptionAvailable).mockResolvedValue(false)
    const unavailable = await decryptSecret('v1:abc')
    expect(unavailable.success).toBe(false)
    if (!unavailable.success) expect(unavailable.error.code).toBe('DECRYPT_UNAVAILABLE')
  })
})
