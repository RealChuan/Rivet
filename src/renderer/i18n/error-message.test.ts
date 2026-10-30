import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.unmock('i18next')
vi.unmock('react-i18next')

import { ApiError } from '../api/result.js'
import i18n from './config.js'
import { errorMessageKey, resolveErrorMessage } from './error-message.js'

describe('error-message', () => {
  beforeAll(async () => {
    if (!i18n.isInitialized) {
      await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()))
    }
    await i18n.changeLanguage('en-US')
  })

  it('maps known codes to errors.<CODE>', () => {
    expect(errorMessageKey('AUTH_ERROR')).toBe('errors.AUTH_ERROR')
    expect(errorMessageKey('HOST_KEY_UNKNOWN')).toBe('errors.HOST_KEY_UNKNOWN')
  })

  it('falls back to errors.UNKNOWN for unmapped codes', () => {
    expect(errorMessageKey('PING_ERROR')).toBe('errors.UNKNOWN')
  })

  it('reads ApiError.code', () => {
    const error = new ApiError({ code: 'CONN_FAILED', message: 'raw backend text' })
    const t = i18n.t.bind(i18n)

    expect(resolveErrorMessage(t, error)).toBe('Connection failed')
  })

  it('never returns the backend message', () => {
    const error = new ApiError({
      code: 'PERMISSION_DENIED',
      message: 'EACCES: /home/user/secret',
    })
    const t = i18n.t.bind(i18n)

    expect(resolveErrorMessage(t, error)).not.toContain('/home/user/secret')
  })

  it('appends only the sanitized server message from detail', () => {
    const error = new ApiError({
      code: 'NOT_SUPPORTED',
      message: 'debug text with /home/user/secret',
      detail: { serverMessage: 'Method\nNot Allowed' },
    })
    const t = i18n.t.bind(i18n)

    const message = resolveErrorMessage(t, error)
    expect(message).toBe('The server does not support this operation: Method Not Allowed')
    expect(message).not.toContain('/home/user/secret')
  })

  it('falls back for unknown values', () => {
    const t = i18n.t.bind(i18n)

    expect(resolveErrorMessage(t, new Error('boom'))).toBe('Operation failed')
    expect(resolveErrorMessage(t, 'boom')).toBe('Operation failed')
  })
})
