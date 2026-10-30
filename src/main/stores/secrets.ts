import { safeStorage } from 'electron'
import { ERROR_CODE } from '@shared/constants/index.js'
import { createErrorInfo, err, type ErrorInfo, ok, type Result } from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import { logger } from '../utils/index.js'

const SECRET_PREFIX = 'v1:'

export async function isSecretStorageAvailable(): Promise<boolean> {
  try {
    return await safeStorage.isAsyncEncryptionAvailable()
  } catch (error) {
    logger.catch(error, { action: 'secret-storage-availability' })
    return false
  }
}

export async function encryptSecret(plain: string): Promise<string | null> {
  if (!(await isSecretStorageAvailable())) return null
  try {
    const encrypted = await safeStorage.encryptStringAsync(plain)
    return `${SECRET_PREFIX}${encrypted.toString('base64')}`
  } catch (error) {
    logger.catch(error, { action: 'encrypt-secret' })
    return null
  }
}

export async function decryptSecret(stored: string): Promise<Result<string, ErrorInfo>> {
  if (!stored.startsWith(SECRET_PREFIX)) {
    return err(createErrorInfo(ERROR_CODE.DECRYPT_FORMAT_ERROR, 'Unsupported secret format'))
  }
  if (!(await isSecretStorageAvailable())) {
    return err(createErrorInfo(ERROR_CODE.DECRYPT_UNAVAILABLE, 'safeStorage is unavailable'))
  }
  try {
    const buffer = Buffer.from(stored.slice(SECRET_PREFIX.length), 'base64')
    const decrypted = await safeStorage.decryptStringAsync(buffer)
    // 系统密钥轮换后需要再解密一次，才能拿到新的密文对应的明文。
    const result = decrypted.shouldReEncrypt
      ? (await safeStorage.decryptStringAsync(buffer)).result
      : decrypted.result
    return ok(result)
  } catch (error) {
    logger.catch(error, { action: 'decrypt-secret' })
    return err(
      createErrorInfo(
        ERROR_CODE.DECRYPTION_ERROR,
        'Failed to decrypt secret',
        formatErrorMessage(error),
      ),
    )
  }
}
