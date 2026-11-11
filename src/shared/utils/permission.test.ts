import { describe, expect, it } from 'vitest'
import { formatPermissions, parsePermissions } from './permission.js'

describe('formatPermissions', () => {
  it('把权限位格式化成 9 位符号串', () => {
    expect(formatPermissions(0o755)).toBe('rwxr-xr-x')
    expect(formatPermissions(0o644)).toBe('rw-r--r--')
    expect(formatPermissions(0o000)).toBe('---------')
  })

  it('忽略 setuid/setgid/sticky 与文件类型位', () => {
    expect(formatPermissions(0o104644)).toBe('rw-r--r--')
    expect(formatPermissions(0o2755)).toBe('rwxr-xr-x')
  })
})

describe('parsePermissions', () => {
  it('把 9 位符号串解析回权限位', () => {
    expect(parsePermissions('rwxr-xr-x')).toBe(0o755)
    expect(parsePermissions('rw-r--r--')).toBe(0o644)
    expect(parsePermissions('---------')).toBe(0o000)
  })

  it('与 formatPermissions 互逆', () => {
    for (const mode of [0o777, 0o600, 0o644, 0o755, 0o700, 0o000]) {
      expect(parsePermissions(formatPermissions(mode))).toBe(mode)
    }
  })

  it('格式不符时返回 null', () => {
    expect(parsePermissions('')).toBeNull()
    expect(parsePermissions('rwxr-xr-')).toBeNull()
    expect(parsePermissions('-rw-r--r--')).toBeNull()
    expect(parsePermissions('755')).toBeNull()
  })
})
