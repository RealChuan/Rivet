import { describe, expect, it } from 'vitest'
import { isHttpSuccess, statusLineCode } from './http-status.js'

describe('isHttpSuccess', () => {
  it('2xx 为成功，边界外为失败', () => {
    expect(isHttpSuccess(200)).toBe(true)
    expect(isHttpSuccess(299)).toBe(true)
    expect(isHttpSuccess(199)).toBe(false)
    expect(isHttpSuccess(300)).toBe(false)
  })
})

describe('statusLineCode', () => {
  it('解析状态行里的三位状态码', () => {
    expect(statusLineCode('HTTP/1.1 200 OK')).toBe(200)
    expect(statusLineCode('HTTP/1.1 207 Multi-Status')).toBe(207)
    expect(statusLineCode('HTTP/2 204')).toBe(204)
  })

  it('不是状态行时返回 null，不会被四位数字骗过', () => {
    expect(statusLineCode('')).toBeNull()
    expect(statusLineCode('200')).toBeNull()
    expect(statusLineCode('HTTP/1.1 2000 Not Found')).toBeNull()
  })
})
