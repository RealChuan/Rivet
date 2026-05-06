import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseMultistatus } from './xml.js'

function fixture(name: string): string {
  return fs.readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')
}

describe('parseMultistatus', () => {
  it('解析 D: 命名空间、编码 href，并跳过 basePath 自身', () => {
    const entries = parseMultistatus(fixture('multistatus-basic.xml'), '/dav')

    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      href: '/dav/中文.txt',
      name: '中文.txt',
      size: 12,
      lastModified: new Date('Wed, 01 Jan 2031 00:00:00 GMT').getTime(),
      isDirectory: false,
    })
    expect(entries[1]).toMatchObject({ href: '/dav/sub', name: 'sub', isDirectory: true })
  })

  it('includeSelf 为 true 时保留 basePath 条目', () => {
    const entries = parseMultistatus(fixture('multistatus-basic.xml'), '/dav', {
      includeSelf: true,
    })

    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatchObject({ href: '/dav', isDirectory: true })
  })

  it('支持小写命名空间与绝对 URL href', () => {
    const entries = parseMultistatus(fixture('multistatus-lowercase-absolute.xml'), '/dav')

    expect(entries).toEqual([
      {
        href: '/dav/a b.txt',
        name: 'a b.txt',
        size: 3,
        lastModified: 0,
        isDirectory: false,
      },
    ])
  })

  it('缺失属性回落 0，非 200 propstat 的条目被跳过', () => {
    const entries = parseMultistatus(fixture('multistatus-missing-props.xml'), '/dav')

    expect(entries).toEqual([
      { href: '/dav/empty.txt', name: 'empty.txt', size: 0, lastModified: 0, isDirectory: false },
    ])
  })
})
