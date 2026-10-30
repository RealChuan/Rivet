import { describe, expect, it } from 'vitest'
import { sanitizeFiles } from './sanitize-files.js'

const valid = {
  name: 'a.txt',
  type: 'file',
  size: 1,
  modifyTime: 0,
  absolutePath: '/a.txt',
}

describe('sanitizeFiles', () => {
  it('保留合法项并补齐可选字段', () => {
    expect(sanitizeFiles([valid])).toEqual([{ ...valid, permissions: '', owner: '' }])
  })

  it('丢弃空名、非法 type、负数大小与缺失绝对路径的项', () => {
    const input: unknown[] = [
      { ...valid, name: '' },
      { ...valid, type: 'link' },
      { ...valid, size: -1 },
      { ...valid, absolutePath: '' },
      valid,
    ]

    expect(sanitizeFiles(input)).toHaveLength(1)
  })

  it('把非法文件名字符替换为下划线', () => {
    expect(sanitizeFiles([{ ...valid, name: 'a/b:c*?"<>|' }])[0]?.name).toBe('a_b_c______')
  })

  it('非数组输入返回空数组', () => {
    expect(sanitizeFiles(null)).toEqual([])
    expect(sanitizeFiles({})).toEqual([])
  })
})
