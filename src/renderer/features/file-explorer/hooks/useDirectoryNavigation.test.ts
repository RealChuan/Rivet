import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileInfo } from '@shared/types/index.js'
import { useDirectoryNavigation } from './useDirectoryNavigation.js'

describe('useDirectoryNavigation', () => {
  const mockUpdateCurrentPath = vi.fn()
  const mockRefreshCurrentDirectory = vi.fn().mockResolvedValue(undefined)
  const mockOnNavigateComplete = vi.fn()

  const sessionId = 'session-1'
  const currentPath = '/home/user'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should navigate to a new path', async () => {
    const { result } = renderHook(() =>
      useDirectoryNavigation(
        sessionId,
        currentPath,
        mockUpdateCurrentPath,
        mockRefreshCurrentDirectory,
        mockOnNavigateComplete
      )
    )
    await act(async () => {
      await result.current.handleNavigate('/home/user/documents')
    })
    expect(mockUpdateCurrentPath).toHaveBeenCalledWith('session-1', '/home/user/documents')
    expect(mockRefreshCurrentDirectory).toHaveBeenCalledWith('session-1')
    expect(mockOnNavigateComplete).toHaveBeenCalled()
  })

  it('should navigate into directory on double click', () => {
    const dirFile: FileInfo = {
      name: 'documents',
      type: 'directory',
      size: 0,
      modifyTime: 0,
      permissions: '',
      owner: '',
      absolutePath: '/home/user/documents',
    }
    const { result } = renderHook(() =>
      useDirectoryNavigation(
        sessionId,
        currentPath,
        mockUpdateCurrentPath,
        mockRefreshCurrentDirectory,
        mockOnNavigateComplete
      )
    )
    act(() => {
      result.current.handleDoubleClick(dirFile)
    })
    expect(mockUpdateCurrentPath).toHaveBeenCalledWith('session-1', '/home/user/documents')
  })

  it('should not navigate on double click for files', () => {
    const file: FileInfo = {
      name: 'readme.txt',
      type: 'file',
      size: 100,
      modifyTime: 0,
      permissions: '',
      owner: '',
      absolutePath: '/home/user/readme.txt',
    }
    const { result } = renderHook(() =>
      useDirectoryNavigation(
        sessionId,
        currentPath,
        mockUpdateCurrentPath,
        mockRefreshCurrentDirectory,
        mockOnNavigateComplete
      )
    )
    act(() => {
      result.current.handleDoubleClick(file)
    })
    expect(mockUpdateCurrentPath).not.toHaveBeenCalled()
  })

  it('should navigate to parent directory', () => {
    const { result } = renderHook(() =>
      useDirectoryNavigation(
        sessionId,
        currentPath,
        mockUpdateCurrentPath,
        mockRefreshCurrentDirectory,
        mockOnNavigateComplete
      )
    )
    act(() => {
      result.current.handleParentDirectory()
    })
    expect(mockUpdateCurrentPath).toHaveBeenCalledWith('session-1', '/home')
  })

  it('should not navigate up from root', () => {
    const { result } = renderHook(() =>
      useDirectoryNavigation(
        sessionId,
        '/',
        mockUpdateCurrentPath,
        mockRefreshCurrentDirectory,
        mockOnNavigateComplete
      )
    )
    act(() => {
      result.current.handleParentDirectory()
    })
    expect(mockUpdateCurrentPath).not.toHaveBeenCalled()
  })
})
