import { describe, expect, it } from 'vitest'
import { localTempPath, remoteTempPath } from './temp-path.js'

describe('remoteTempPath', () => {
  it('与目标同目录、隐藏、带随机串与固定后缀', () => {
    expect(remoteTempPath('/dir/a.txt')).toMatch(/^\/dir\/\.a\.txt\.[0-9a-f-]{36}\.rivet-tmp$/)
  })

  it('同名目标每次生成的临时名都不同', () => {
    expect(remoteTempPath('/dir/a.txt')).not.toBe(remoteTempPath('/dir/a.txt'))
  })
})

describe('localTempPath', () => {
  it('在目标路径后追加下载后缀', () => {
    expect(localTempPath('/local/a.txt')).toBe('/local/a.txt.rivet-download')
  })
})
