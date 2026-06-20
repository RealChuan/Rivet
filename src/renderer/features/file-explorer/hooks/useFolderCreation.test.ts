import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFolderCreation } from './use-folder-creation.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | ((ns: unknown) => unknown)) => {
      if (typeof key === 'function') {
        const path: string[] = []
        const proxy = new Proxy(
          {},
          {
            get(_target, prop) {
              if (typeof prop === 'string') path.push(prop)
              return proxy
            },
          },
        )
        key(proxy)
        return path.join('.')
      }
      return key
    },
  }),
}))

const mockRefreshCurrentDirectory = vi.fn().mockResolvedValue(undefined)
const mockSetOperating = vi.fn()
const mockAddToast = vi.fn()

vi.mock('@renderer/features/session/stores/session.js', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      refreshCurrentDirectory: mockRefreshCurrentDirectory,
      setOperating: mockSetOperating,
      sessions: [],
    }),
}))

vi.mock('@renderer/stores/index.js', () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
}))

const mockMkdir = vi.fn()

describe('useFolderCreation', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      electronAPI: {
        protocol: { mkdir: mockMkdir },
      },
    })
    mockMkdir.mockReset()
    mockRefreshCurrentDirectory.mockReset().mockResolvedValue(undefined)
    mockAddToast.mockReset()
  })

  it('should construct path correctly when currentPath is root', async () => {
    mockMkdir.mockResolvedValue({
      requestId: '1',
      success: true,
      value: undefined,
      error: undefined,
    })

    const { result } = renderHook(() => useFolderCreation('session-1'))
    await act(async () => {
      await result.current.handleCreateFolder('/', 'new-folder')
    })

    expect(mockMkdir).toHaveBeenCalledWith('session-1', '/new-folder')
  })

  it('should construct path correctly when currentPath is not root', async () => {
    mockMkdir.mockResolvedValue({
      requestId: '1',
      success: true,
      value: undefined,
      error: undefined,
    })

    const { result } = renderHook(() => useFolderCreation('session-1'))
    await act(async () => {
      await result.current.handleCreateFolder('/home/user', 'new-folder')
    })

    expect(mockMkdir).toHaveBeenCalledWith('session-1', '/home/user/new-folder')
  })

  it('should show success toast and refresh directory on success', async () => {
    mockMkdir.mockResolvedValue({
      requestId: '1',
      success: true,
      value: undefined,
      error: undefined,
    })

    const { result } = renderHook(() => useFolderCreation('session-1'))
    await act(async () => {
      await result.current.handleCreateFolder('/home', 'folder')
    })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      message: 'toast.createFolderSuccess',
    })
    expect(mockRefreshCurrentDirectory).toHaveBeenCalledWith('session-1')
  })

  it('should show error toast and not refresh on failure', async () => {
    const errorObj = { code: 'EEXIST', message: 'File exists' }
    mockMkdir.mockResolvedValue({
      requestId: '1',
      success: false,
      value: undefined,
      error: errorObj,
    })

    const { result } = renderHook(() => useFolderCreation('session-1'))
    await act(async () => {
      await result.current.handleCreateFolder('/home', 'folder')
    })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      message: `toast.createFolderFailed: ${JSON.stringify(errorObj)}`,
    })
    expect(mockRefreshCurrentDirectory).not.toHaveBeenCalled()
  })

  it('should show Unknown error when formatErrorMessage returns empty', async () => {
    mockMkdir.mockResolvedValue({
      requestId: '1',
      success: false,
      value: undefined,
      error: '',
    })

    const { result } = renderHook(() => useFolderCreation('session-1'))
    await act(async () => {
      await result.current.handleCreateFolder('/home', 'folder')
    })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      message: 'toast.createFolderFailed: error.unknown',
    })
  })
})
