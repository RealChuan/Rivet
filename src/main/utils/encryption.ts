import { safeStorage } from 'electron'
import crypto from 'node:crypto'
import { ERROR_CODE } from '@shared/constants/index.js'
import { createErrorInfo, err, type ErrorInfo, ok, type Result } from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import { logger } from './index.js'

const SAFE_PREFIX = 'safe:'
const HMAC_KEY_ENV = 'RIVET_HMAC_KEY'
const HMAC_LENGTH = 32

/**
 * 获取 HMAC 密钥
 *
 * 优先从环境变量 RIVET_HMAC_KEY 读取（hex 编码，64 字符 = 32 字节），
 * 若未设置则使用固定种子哈希派生。
 *
 * 注意：不能使用 safeStorage.encryptString() 派生密钥，
 * 因为它每次调用返回不同的加密结果（内部使用随机 IV），
 * 会导致加密和解密时派生出不同的 HMAC 密钥。
 */
function getHmacKey(): Buffer {
  const envKey = process.env[HMAC_KEY_ENV]
  if (envKey?.length === 64) {
    return Buffer.from(envKey, 'hex')
  }
  const seed = 'Rivet-HMAC-Key-Derivation-Seed-v1'
  return crypto.createHash('sha256').update(seed).digest()
}

function computeHmac(data: string, hmacKey: Buffer): string {
  return crypto.createHmac('sha256', hmacKey).update(data).digest('hex')
}

export function encryptPassword(password: string): Result<string, ErrorInfo> {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      logger.warn('safeStorage encryption not available, password will not be persisted')
      return err(
        createErrorInfo(ERROR_CODE.ENCRYPT_UNAVAILABLE, 'safeStorage encryption not available'),
      )
    }

    const encrypted = safeStorage.encryptString(password).toString('base64')
    const hmacKey = getHmacKey()
    const hmac = computeHmac(encrypted, hmacKey)
    return ok(SAFE_PREFIX + hmac + encrypted)
  } catch (error) {
    logger.catch(error, { action: 'encrypt-password' })
    return err(
      createErrorInfo(
        ERROR_CODE.ENCRYPTION_ERROR,
        'Failed to encrypt password',
        formatErrorMessage(error),
      ),
    )
  }
}

export function decryptPassword(encrypted: string): Result<string, ErrorInfo> {
  try {
    if (!encrypted.startsWith(SAFE_PREFIX)) {
      logger.warn('Unsupported password format, password needs to be re-entered')
      return err(createErrorInfo(ERROR_CODE.DECRYPT_FORMAT_ERROR, 'Unsupported password format'))
    }

    if (!safeStorage.isEncryptionAvailable()) {
      logger.warn('safeStorage decryption not available')
      return err(
        createErrorInfo(ERROR_CODE.DECRYPT_UNAVAILABLE, 'safeStorage decryption not available'),
      )
    }

    const hmacKey = getHmacKey()
    const dataWithoutPrefix = encrypted.slice(SAFE_PREFIX.length)
    const hmac = dataWithoutPrefix.slice(0, HMAC_LENGTH * 2)
    const actualData = dataWithoutPrefix.slice(HMAC_LENGTH * 2)
    const computedHmac = computeHmac(actualData, hmacKey)
    if (hmac !== computedHmac) {
      logger.warn('HMAC verification failed, password needs to be re-entered')
      return err(createErrorInfo(ERROR_CODE.HMAC_MISMATCH, 'HMAC verification failed'))
    }
    const buffer = Buffer.from(actualData, 'base64')
    return ok(safeStorage.decryptString(buffer))
  } catch (error) {
    logger.catch(error, { action: 'decrypt-password' })
    return err(
      createErrorInfo(
        ERROR_CODE.DECRYPTION_ERROR,
        'Failed to decrypt password',
        formatErrorMessage(error),
      ),
    )
  }
}
