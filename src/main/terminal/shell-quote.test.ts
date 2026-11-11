import { describe, expect, it } from 'vitest'
import { shellQuote } from './shell-quote.js'

describe('shellQuote', () => {
  it('普通路径加单引号', () => {
    expect(shellQuote('/var/log')).toBe("'/var/log'")
  })

  it('含单引号的路径被正确转义', () => {
    expect(shellQuote("/tmp/it's")).toBe("'/tmp/it'\\''s'")
  })

  it('中文与空格原样保留', () => {
    expect(shellQuote('/data/我的 文件')).toBe("'/data/我的 文件'")
  })
})
