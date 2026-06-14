import { isOk } from '@shared/types/index.js'

export async function encryptPassword(password: string): Promise<string> {
  const result = await window.electronAPI.crypto.encryptPassword(password)
  if (!isOk(result)) {
    throw new Error('Password encryption failed')
  }
  return result.value
}

export async function decryptPassword(encrypted: string): Promise<string> {
  const result = await window.electronAPI.crypto.decryptPassword(encrypted)
  if (!isOk(result)) {
    throw new Error('Password decryption failed')
  }
  return result.value
}
