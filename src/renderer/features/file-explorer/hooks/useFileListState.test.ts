import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFileListState } from './useFileListState.js'
import type { FileInfo } from '@shared/types/index.js'

const mockFile: FileInfo = {
  name: 'test.txt',
  type: 'file',
  size: 100,
  modifyTime: 1000,
  permissions: 'rw-r--r--',
  owner: 'user',
  absolutePath: '/test.txt',
}

const mockFile2: FileInfo = {
  name: 'test2.txt',
  type: 'file',
  size: 200,
  modifyTime: 2000,
  permissions: 'rw-r--r--',
  owner: 'user',
  absolutePath: '/test2.txt',
}

describe('useFileListState', () => {
  it('should have correct initial state', () => {
    const { result } = renderHook(() => useFileListState())
    expect(result.current.selectedFile).toBeNull()
    expect(result.current.selectedFiles).toEqual([])
    expect(result.current.deleteDialogOpen).toBe(false)
    expect(result.current.renameDialogOpen).toBe(false)
    expect(result.current.fileToDelete).toBeNull()
    expect(result.current.newFolderDialogOpen).toBe(false)
    expect(result.current.hoveredFile).toBeNull()
    expect(result.current.contextMenu).toBeNull()
  })

  it('should select a file', () => {
    const { result } = renderHook(() => useFileListState())
    act(() => {
      result.current.handleSelectFile(mockFile)
    })
    expect(result.current.selectedFile).toEqual(mockFile)
    expect(result.current.selectedFiles).toEqual([mockFile])
  })

  it('should handle ctrl+click to toggle selection', () => {
    const { result } = renderHook(() => useFileListState())
    act(() => {
      result.current.handleSelectFile(mockFile)
    })
    act(() => {
      result.current.handleMultiSelect(mockFile2, true, false, [mockFile, mockFile2])
    })
    expect(result.current.selectedFiles).toHaveLength(2)
    act(() => {
      result.current.handleMultiSelect(mockFile2, true, false, [mockFile, mockFile2])
    })
    expect(result.current.selectedFiles).toHaveLength(1)
  })

  it('should handle shift+click for range selection', () => {
    const sortedFiles = [mockFile, mockFile2]
    const { result } = renderHook(() => useFileListState())
    act(() => {
      result.current.handleSelectFile(mockFile)
    })
    act(() => {
      result.current.handleMultiSelect(mockFile2, false, true, sortedFiles)
    })
    expect(result.current.selectedFiles).toEqual([mockFile, mockFile2])
  })

  it('should clear selection', () => {
    const { result } = renderHook(() => useFileListState())
    act(() => {
      result.current.handleSelectFile(mockFile)
    })
    act(() => {
      result.current.clearSelection()
    })
    expect(result.current.selectedFiles).toEqual([])
    expect(result.current.selectedFile).toBeNull()
  })

  it('should open and close delete dialog', () => {
    const { result } = renderHook(() => useFileListState())
    act(() => {
      result.current.openDeleteDialog([mockFile])
    })
    expect(result.current.deleteDialogOpen).toBe(true)
    expect(result.current.fileToDelete).toEqual([mockFile])
    act(() => {
      result.current.closeDeleteDialog()
    })
    expect(result.current.deleteDialogOpen).toBe(false)
    expect(result.current.fileToDelete).toBeNull()
  })

  it('should open and close rename dialog', () => {
    const { result } = renderHook(() => useFileListState())
    act(() => {
      result.current.openRenameDialog(mockFile)
    })
    expect(result.current.renameDialogOpen).toBe(true)
    expect(result.current.selectedFile).toEqual(mockFile)
    act(() => {
      result.current.closeRenameDialog()
    })
    expect(result.current.renameDialogOpen).toBe(false)
  })

  it('should open and close context menu', () => {
    const { result } = renderHook(() => useFileListState())
    act(() => {
      result.current.openContextMenu(100, 200, [mockFile], false)
    })
    expect(result.current.contextMenu).toEqual({
      x: 100,
      y: 200,
      files: [mockFile],
      isEmptyArea: false,
    })
    act(() => {
      result.current.closeContextMenu()
    })
    expect(result.current.contextMenu).toBeNull()
  })

  it('should set hovered file', () => {
    const { result } = renderHook(() => useFileListState())
    act(() => {
      result.current.setHoveredFile('test.txt')
    })
    expect(result.current.hoveredFile).toBe('test.txt')
  })
})
