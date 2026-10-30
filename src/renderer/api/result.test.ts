import { describe, expect, it } from 'vitest'
import { ApiError, isApiError, unwrap } from './result.js'

describe('unwrap', () => {
  it('成功信封返回裸值', () => {
    expect(unwrap({ success: true, value: 42 })).toBe(42)
  })

  it('失败信封抛 ApiError，保留 code 与 message', () => {
    try {
      unwrap({ success: false, error: { code: 'AUTH_ERROR', message: 'bad password' } })
      expect.unreachable()
    } catch (error) {
      expect(isApiError(error)).toBe(true)
      expect(error).toMatchObject({ name: 'ApiError', code: 'AUTH_ERROR', message: 'bad password' })
    }
  })

  it('兼容旧 ProtocolResponse 的成功信封', () => {
    const legacy = { success: true, value: 'x', error: undefined } satisfies {
      success: true
      value: string
      error: undefined
    }
    expect(unwrap(legacy)).toBe('x')
  })

  it('AppError 没有 message 时用 code 兜底', () => {
    const error = new ApiError({ code: 'CONFIG_ERROR', message: '' })
    expect(error.message).toBe('CONFIG_ERROR')
  })
})
