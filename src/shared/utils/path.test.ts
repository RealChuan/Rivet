import { describe, expect, it } from 'vitest'
import { getParentPath, isSubPath, joinPaths, normalizePath, sanitizePath } from './path.js'

describe('path utilities', () => {
  describe('normalizePath', () => {
    it('should normalize simple path', () => {
      expect(normalizePath('/home/user')).toBe('/home/user')
    })

    it('should handle double slashes', () => {
      expect(normalizePath('//home//user//')).toBe('/home/user')
    })

    it('should return empty string for empty input', () => {
      expect(normalizePath('')).toBe('')
    })

    it('should return root for all slashes', () => {
      expect(normalizePath('///')).toBe('/')
    })

    it('should throw for non-string input', () => {
      expect(() => normalizePath(42 as unknown as string)).toThrow(TypeError)
    })

    it('should remove current directory references', () => {
      expect(normalizePath('/home/./user/./documents')).toBe('/home/user/documents')
    })

    it('should preserve relative paths', () => {
      expect(normalizePath('home/user')).toBe('home/user')
    })

    it('should normalize relative paths with redundant slashes', () => {
      expect(normalizePath('home//user')).toBe('home/user')
    })

    it('should normalize relative paths with current directory references', () => {
      expect(normalizePath('home/./user')).toBe('home/user')
    })
  })

  describe('joinPaths', () => {
    it('should join path segments', () => {
      expect(joinPaths('/home', 'user', 'file.txt')).toBe('/home/user/file.txt')
    })

    it('should handle empty segments', () => {
      expect(joinPaths('/home', '', 'user')).toBe('/home/user')
    })

    it('should handle undefined segments', () => {
      expect(joinPaths('/home', undefined as unknown as string, 'user')).toBe('/home/user')
    })
  })

  describe('getParentPath', () => {
    it('should get parent path', () => {
      expect(getParentPath('/path/to/file.txt')).toBe('/path/to')
    })

    it('should return root for root', () => {
      expect(getParentPath('/')).toBe('/')
    })

    it('should return root for single segment', () => {
      expect(getParentPath('/root')).toBe('/')
    })
  })

  describe('isSubPath', () => {
    it('should return true for same path', () => {
      expect(isSubPath('/home/user', '/home/user')).toBe(true)
    })

    it('should return true for child path', () => {
      expect(isSubPath('/home', '/home/user/file.txt')).toBe(true)
    })

    it('should return false for unrelated path', () => {
      expect(isSubPath('/home', '/other/path')).toBe(false)
    })

    it('should return false for parent path', () => {
      expect(isSubPath('/home/user', '/home')).toBe(false)
    })

    it('should handle root path', () => {
      expect(isSubPath('/', '/any/path')).toBe(true)
    })
  })

  describe('sanitizePath', () => {
    it('should allow normal paths', () => {
      expect(sanitizePath('/home/user/documents')).toBe('/home/user/documents')
    })

    it('should reject path traversal', () => {
      expect(() => sanitizePath('/home/user/../../etc/passwd')).toThrow('Path traversal detected')
    })

    it('should normalize paths with redundant slashes', () => {
      expect(sanitizePath('/home//user///documents')).toBe('/home/user/documents')
    })

    it('should normalize paths with current directory references', () => {
      expect(sanitizePath('/home/./user/./documents')).toBe('/home/user/documents')
    })

    it('should reject path traversal at the beginning', () => {
      expect(() => sanitizePath('/../../etc/passwd')).toThrow('Path traversal detected')
    })

    it('should reject path traversal in relative paths', () => {
      expect(() => sanitizePath('../etc/passwd')).toThrow('Path traversal detected')
    })

    it('should allow paths without traversal', () => {
      expect(sanitizePath('/home/user/.bashrc')).toBe('/home/user/.bashrc')
    })
  })

  describe('sanitizePath - URL encoding bypass', () => {
    it('rejects URL-encoded path traversal (%2e%2e)', () => {
      expect(() => sanitizePath('/home/%2e%2e/etc/passwd')).toThrow('Path traversal detected')
    })

    it('rejects mixed-case URL-encoded path traversal (%2E%2E)', () => {
      expect(() => sanitizePath('/home/%2E%2E/etc/passwd')).toThrow('Path traversal detected')
    })

    it('rejects URL-encoded slash + traversal (%2e%2e%2f)', () => {
      expect(() => sanitizePath('/home/%2e%2e%2f/etc/passwd')).toThrow('Path traversal detected')
    })

    it('allows paths with URL-encoded safe characters', () => {
      expect(sanitizePath('/home/user/my%20file')).toBe('/home/user/my%20file')
    })
  })
})
