import { describe, expect, it } from 'vitest'
import { PROVIDER_KIND } from './entry.js'
import { isErrorCode } from './error.js'

describe('协议领域类型', () => {
  it('ProviderKind 包含 sftp、smb、webdav 与 s3', () => {
    expect(Object.values(PROVIDER_KIND)).toEqual(['sftp', 'smb', 'webdav', 's3'])
  })

  it('新错误码可被 isErrorCode 识别', () => {
    expect(isErrorCode('KEY_FILE_UNREADABLE')).toBe(true)
    expect(isErrorCode('PASSPHRASE_REQUIRED')).toBe(true)
    expect(isErrorCode('AGENT_NO_IDENTITY')).toBe(true)
    expect(isErrorCode('NOT_A_CODE')).toBe(false)
  })
})
