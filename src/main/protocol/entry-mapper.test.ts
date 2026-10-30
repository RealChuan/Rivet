import { describe, expect, it } from 'vitest'
import type { Entry } from '@shared/domain/entry.js'
import { FILE_TYPE } from '@shared/constants/ui.js'
import { toFileInfo } from './entry-mapper.js'

const base: Entry = {
  name: 'docs',
  kind: 'directory',
  size: 0,
  mtime: 1700000000000,
  path: '/remote/docs',
}

describe('toFileInfo', () => {
  it('把目录映射为 FILE_TYPE.DIRECTORY', () => {
    expect(toFileInfo(base)).toEqual({
      name: 'docs',
      type: FILE_TYPE.DIRECTORY,
      size: 0,
      modifyTime: 1700000000000,
      permissions: '',
      owner: '',
      absolutePath: '/remote/docs',
    })
  })

  it('把文件与符号链接都映射为 FILE', () => {
    expect(toFileInfo({ ...base, kind: 'file', size: 12 }).type).toBe(FILE_TYPE.FILE)
    expect(toFileInfo({ ...base, kind: 'symlink', size: 0 }).type).toBe(FILE_TYPE.FILE)
  })

  it('保留权限与所有者', () => {
    const info = toFileInfo({ ...base, kind: 'file', permissions: 'rw-r--r--', owner: 'alice' })
    expect(info.permissions).toBe('rw-r--r--')
    expect(info.owner).toBe('alice')
  })
})
