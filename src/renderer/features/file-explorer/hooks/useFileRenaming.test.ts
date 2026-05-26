import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFileRenaming } from './useFileRenaming.js'
import type { FileInfo } from '@shared/types/index.js'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const mockRefreshCurrentDirectory = vi.fn().mockResolvedValue(undefined)
const mockAddToast = vi.fn()

vi.mock('@renderer/features/session/stores/session.js', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ refreshCurrentDirectory: mockRefreshCurrentDirectory }),
}))

vi.mock('@renderer/stores/index.js', () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
}))

const mockRename = vi.fn()

const mockFile: FileInfo = {
  name: 'old-name.txt',
  type: 'file',
  size: 100,
  modifyTime: 1000,
  absolutePath: '/home/old-name.txt',
}

describe('useFileRenaming', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      electronAPI: {
        protocol: { rename: mockRename },
      },
    })
    mockRename.mockReset()
    mockRefreshCurrentDirectory.mockReset().mockResolvedValue(undefined)
    mockAddToast.mockReset()
  })

  it('should call rename with sessionId, file, and newName', async () => {
    mockRename.mockResolvedValue({
      requestId: '1',
      success: true,
      value: undefined,
      error: undefined,
    })

    const { result } = renderHook(() => useFileRenaming('session-1'))
    await act(async () => {
      await result.current.handleRename(mockFile, 'new-name.txt')
    })

    expect(mockRename).toHaveBeenCalledWith('session-1', mockFile, 'new-name.txt')
  })

  it('should show success toast and refresh directory on success', async () => {
    mockRename.mockResolvedValue({
      requestId: '1',
      success: true,
      value: undefined,
      error: undefined,
    })

    const { result } = renderHook(() => useFileRenaming('session-1'))
    await act(async () => {
      await result.current.handleRename(mockFile, 'new-name.txt')
    })

    expect(mockAddToast).toHaveBeenCalledWith({ type: 'success', message: 'toast.renameSuccess' })
    expect(mockRefreshCurrentDirectory).toHaveBeenCalledWith('session-1')
  })

  it('should show error toast and not refresh on failure', async () => {
    const errorObj = { code: 'ENOENT', message: 'No such file' }
    mockRename.mockResolvedValue({
      requestId: '1',
      success: false,
      value: undefined,
      error: errorObj,
    })

    const { result } = renderHook(() => useFileRenaming('session-1'))
    await act(async () => {
      await result.current.handleRename(mockFile, 'new-name.txt')
    })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      message: `toast.renameFailed: ${JSON.stringify(errorObj)}`,
    })
    expect(mockRefreshCurrentDirectory).not.toHaveBeenCalled()
  })

  it('should show Unknown error when formatErrorMessage returns empty', async () => {
    mockRename.mockResolvedValue({
      requestId: '1',
      success: false,
      value: undefined,
      error: '',
    })

    const { result } = renderHook(() => useFileRenaming('session-1'))
    await act(async () => {
      await result.current.handleRename(mockFile, 'new-name.txt')
    })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      message: 'toast.renameFailed: error.unknown',
    })
  })
})
