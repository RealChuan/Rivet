import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('dialog utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('showSaveDialog', () => {
    it('should return dialog result when successful', async () => {
      const mockResult = { canceled: false, filePath: '/path/to/file.txt' }

      vi.doMock('electron', () => ({
        dialog: {
          showSaveDialog: vi.fn().mockResolvedValue(mockResult),
        },
      }))
      vi.doMock('./logger.js', () => ({
        logger: { catch: vi.fn() },
      }))

      const { showSaveDialog } = await import('./dialog.js')
      const result = await showSaveDialog({ title: 'Save File' })

      expect(result.success).toBe(true)
      expect(result.value).toEqual(mockResult)
    })

    it('should return error when dialog throws', async () => {
      vi.doMock('electron', () => ({
        dialog: {
          showSaveDialog: vi.fn().mockRejectedValue(new Error('Dialog error')),
        },
      }))
      vi.doMock('./logger.js', () => ({
        logger: { catch: vi.fn() },
      }))

      const { showSaveDialog } = await import('./dialog.js')
      const result = await showSaveDialog({ title: 'Save File' })

      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('DIALOG_ERROR')
    })
  })

  describe('showOpenDialog', () => {
    it('should return dialog result when successful', async () => {
      const mockResult = {
        canceled: false,
        filePaths: ['/path/to/file1.txt', '/path/to/file2.txt'],
      }

      vi.doMock('electron', () => ({
        dialog: {
          showOpenDialog: vi.fn().mockResolvedValue(mockResult),
        },
      }))
      vi.doMock('./logger.js', () => ({
        logger: { catch: vi.fn() },
      }))

      const { showOpenDialog } = await import('./dialog.js')
      const result = await showOpenDialog({ title: 'Open File' })

      expect(result.success).toBe(true)
      expect(result.value).toEqual(mockResult)
    })

    it('should return error when dialog throws', async () => {
      vi.doMock('electron', () => ({
        dialog: {
          showOpenDialog: vi.fn().mockRejectedValue(new Error('Dialog error')),
        },
      }))
      vi.doMock('./logger.js', () => ({
        logger: { catch: vi.fn() },
      }))

      const { showOpenDialog } = await import('./dialog.js')
      const result = await showOpenDialog({ title: 'Open File' })

      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('DIALOG_ERROR')
    })
  })
})
