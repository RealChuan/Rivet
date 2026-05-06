import { describe, expect, it } from 'vitest'
import { ERROR_CODE } from '../constants/error-code.js'
import { createErrorInfo, err, isErr, isOk, ok, type Result } from './result.js'

/**
 * 只为验证 `@shared/types/result.js` 这层兼容再导出仍然可用。
 * 行为本身的测试在 `src/shared/domain/{result,error}.test.ts`。
 */
describe('result 兼容层', () => {
  it('再导出 ok / err / 类型守卫', () => {
    const success = ok(42)
    const failure = err(new Error('fail'))

    expect(isOk(success)).toBe(true)
    expect(isErr(failure)).toBe(true)
  })

  it('再导出 Result 泛型仍可窄化', () => {
    const result: Result<number, Error> = ok(42)

    if (isOk(result)) {
      expect(result.value).toBeTypeOf('number')
    }
  })

  it('再导出 createErrorInfo', () => {
    const errorInfo = createErrorInfo(ERROR_CODE.LIST_ERROR, 'failed')

    expect(errorInfo).toEqual({ code: 'LIST_ERROR', message: 'failed' })
  })
})
