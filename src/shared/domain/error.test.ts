import { describe, expect, it } from 'vitest'
import { ERROR_CODE } from '../constants/error-code.js'
import { appErrorSchema, createErrorInfo, toAppError } from './error.js'

describe('toAppError', () => {
  it('保留 Error 的 message，丢弃 stack 与原型', () => {
    const result = toAppError(new Error('boom'), ERROR_CODE.PING_ERROR)
    expect(result).toEqual({ code: 'PING_ERROR', message: 'boom' })
  })

  it('Error 实例上的合法 code 被保留', () => {
    const error = Object.assign(new Error('timed out'), { code: 'REQUEST_TIMEOUT' })
    expect(toAppError(error, ERROR_CODE.INVALID_STATE)).toEqual({
      code: 'REQUEST_TIMEOUT',
      message: 'timed out',
    })
  })

  it('Error 实例上的可序列化 detail 被保留', () => {
    const error = Object.assign(new Error('denied'), {
      code: 'AUTH_ERROR',
      detail: { serverMessage: 'bad credentials' },
    })
    expect(toAppError(error, ERROR_CODE.INVALID_STATE)).toEqual({
      code: 'AUTH_ERROR',
      message: 'denied',
      detail: { serverMessage: 'bad credentials' },
    })
  })

  it('未知值降级为 fallback code', () => {
    expect(toAppError('nope', ERROR_CODE.CONFIG_ERROR)).toEqual({
      code: 'CONFIG_ERROR',
      message: 'nope',
    })
  })

  it('沿用对象里合法的 code', () => {
    expect(toAppError({ code: 'AUTH_ERROR', message: 'denied' }, ERROR_CODE.PING_ERROR)).toEqual({
      code: 'AUTH_ERROR',
      message: 'denied',
    })
  })

  it('非法 code 回退到 fallback，并用 fallback 兜底 message', () => {
    expect(toAppError({ code: 'NOT_A_REAL_CODE' }, ERROR_CODE.INVALID_STATE)).toEqual({
      code: 'INVALID_STATE',
      message: 'INVALID_STATE',
    })
  })

  it('detail 只保留可序列化的纯数据', () => {
    const result = toAppError(
      { code: 'AUTH_ERROR', detail: { at: new Date(0), fn: () => 1 } },
      ERROR_CODE.PING_ERROR,
    )
    expect(result.detail).toEqual({ at: '1970-01-01T00:00:00.000Z' })
  })

  it('detail 无法序列化时整体丢弃', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const result = toAppError({ code: 'AUTH_ERROR', detail: cyclic }, ERROR_CODE.PING_ERROR)
    expect(result.detail).toBeUndefined()
  })
})

describe('appErrorSchema', () => {
  it('接受合法错误对象', () => {
    const parsed = appErrorSchema.parse({ code: 'AUTH_ERROR', message: 'x' })
    expect(parsed.code).toBe('AUTH_ERROR')
  })

  it('拒绝未知错误码', () => {
    expect(() => appErrorSchema.parse({ code: 'NOPE', message: 'x' })).toThrow()
  })
})

describe('createErrorInfo', () => {
  it('把字符串 detail 包装成对象', () => {
    expect(createErrorInfo(ERROR_CODE.LIST_ERROR, 'failed', 'ctx')).toEqual({
      code: 'LIST_ERROR',
      message: 'failed',
      detail: { reason: 'ctx' },
    })
  })
})
