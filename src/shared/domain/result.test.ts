import { describe, expect, it } from 'vitest'
import { ERROR_CODE } from '../constants/error-code.js'
import { err, isErr, isOk, ok } from './result.js'

describe('Result', () => {
  it('ok 的判别字段是 success', () => {
    expect(ok(1)).toEqual({ success: true, value: 1, error: null })
  })

  it('err 携带 AppError 且 isErr 为真', () => {
    const result = err({ code: ERROR_CODE.CONFIG_ERROR, message: 'bad config' })

    expect(isErr(result)).toBe(true)
    expect(isOk(result)).toBe(false)
  })

  it('isOk 收窄后可访问 value', () => {
    const result = ok('payload')

    if (isOk(result)) {
      expect(result.value).toBe('payload')
    }
  })
})
