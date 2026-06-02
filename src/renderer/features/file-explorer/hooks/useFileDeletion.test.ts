import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileInfo } from '@shared/types/index.js'
import { useFileDeletion } from './useFileDeletion.js'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const mockRefreshCurrentDirectory = vi.fn().mockResolvedValue(undefined)
const mockSetOperating = vi.fn()
const mockAddToast = vi.fn()

vi.mock('@renderer/features/session/stores/session.js', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      refreshCurrentDirectory: mockRefreshCurrentDirectory,
      setOperating: mockSetOperating,
    }),
}))

vi.mock('@renderer/stores/index.js', () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
}))

const mockDelete = vi.fn()

const mockFile1: FileInfo = {
  name: 'file1.txt',
  type: 'file',
  size: 100,
  modifyTime: 1000,
  absolutePath: '/home/file1.txt',
}

const mockFile2: FileInfo = {
  name: 'file2.txt',
  type: 'file',
  size: 200,
  modifyTime: 2000,
  absolutePath: '/home/file2.txt',
}

describe('useFileDeletion', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      electronAPI: {
        protocol: { delete: mockDelete },
      },
    })
    mockDelete.mockReset()
    mockRefreshCurrentDirectory.mockReset().mockResolvedValue(undefined)
    mockAddToast.mockReset()
  })

  it('should return early when files array is empty', async () => {
    const { result } = renderHook(() => useFileDeletion('session-1'))
    await act(async () => {
      await result.current.handleDelete([])
    })

    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockAddToast).not.toHaveBeenCalled()
    expect(mockRefreshCurrentDirectory).not.toHaveBeenCalled()
  })

  it('should call delete for each file and show success toast when all succeed', async () => {
    mockDelete.mockResolvedValue({
      requestId: '1',
      success: true,
      value: undefined,
      error: undefined,
    })

    const { result } = renderHook(() => useFileDeletion('session-1'))
    await act(async () => {
      await result.current.handleDelete([mockFile1, mockFile2])
    })

    expect(mockDelete).toHaveBeenCalledWith('session-1', mockFile1)
    expect(mockDelete).toHaveBeenCalledWith('session-1', mockFile2)
    expect(mockDelete).toHaveBeenCalledTimes(2)
    expect(mockAddToast).toHaveBeenCalledWith({ type: 'success', message: 'toast.deleteSuccess' })
    expect(mockRefreshCurrentDirectory).toHaveBeenCalledWith('session-1')
  })

  it('should stop on first failure and show error toast', async () => {
    const errorObj = { code: 'EPERM', message: 'Permission denied' }
    mockDelete
      .mockResolvedValueOnce({ requestId: '1', success: true, value: undefined, error: undefined })
      .mockResolvedValueOnce({
        requestId: '2',
        success: false,
        value: undefined,
        error: errorObj,
      })

    const { result } = renderHook(() => useFileDeletion('session-1'))
    await act(async () => {
      await result.current.handleDelete([mockFile1, mockFile2])
    })

    expect(mockDelete).toHaveBeenCalledTimes(2)
    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      message: `toast.deleteFailed: ${JSON.stringify(errorObj)}`,
    })
    expect(mockRefreshCurrentDirectory).not.toHaveBeenCalled()
  })

  it('should show Unknown error when formatErrorMessage returns empty', async () => {
    mockDelete.mockResolvedValue({
      requestId: '1',
      success: false,
      value: undefined,
      error: '',
    })

    const { result } = renderHook(() => useFileDeletion('session-1'))
    await act(async () => {
      await result.current.handleDelete([mockFile1])
    })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      message: 'toast.deleteFailed: error.unknown',
    })
  })

  it('should handle single file deletion successfully', async () => {
    mockDelete.mockResolvedValue({
      requestId: '1',
      success: true,
      value: undefined,
      error: undefined,
    })

    const { result } = renderHook(() => useFileDeletion('session-1'))
    await act(async () => {
      await result.current.handleDelete([mockFile1])
    })

    expect(mockDelete).toHaveBeenCalledWith('session-1', mockFile1)
    expect(mockAddToast).toHaveBeenCalledWith({ type: 'success', message: 'toast.deleteSuccess' })
    expect(mockRefreshCurrentDirectory).toHaveBeenCalledWith('session-1')
  })
})
