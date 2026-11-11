import { describe, expect, it } from 'vitest'
import { contentTypeOf, DIRECTORY_CONTENT_TYPE } from './content-type.js'

describe('contentTypeOf', () => {
  it('按扩展名推断常见类型', () => {
    expect(contentTypeOf('a/b/photo.PNG')).toBe('image/png')
    expect(contentTypeOf('docs/report.pdf')).toBe('application/pdf')
    expect(contentTypeOf('log.txt')).toBe('text/plain; charset=utf-8')
    expect(contentTypeOf('config.json')).toBe('application/json')
  })

  it('只看最后一段，目录里的点不影响判定', () => {
    expect(contentTypeOf('v1.2/bundle.zip')).toBe('application/zip')
    expect(contentTypeOf('v1.2/README')).toBe('application/octet-stream')
  })

  it('认不出来的扩展名与无扩展名回退到二进制流', () => {
    expect(contentTypeOf('archive.unknownext')).toBe('application/octet-stream')
    expect(contentTypeOf('Makefile')).toBe('application/octet-stream')
    expect(contentTypeOf('.env')).toBe('application/octet-stream')
  })

  it('目录标记用独立的 ContentType', () => {
    expect(DIRECTORY_CONTENT_TYPE).toBe('application/x-directory')
  })
})
