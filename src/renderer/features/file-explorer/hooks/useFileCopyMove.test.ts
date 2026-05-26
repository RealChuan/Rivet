import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFileCopyMove } from './useFileCopyMove.js'
import type { FileInfo } from '@shared/types/index.js'
import type { ConflictResolution } from '@renderer/features/file-explorer/components/ConflictDialog.js'

const mockRefreshCurrentDirectory = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
const mockAddToast = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@renderer/features/session/stores/session.js', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ refreshCurrentDirectory: mockRefreshCurrentDirectory }),
}))

vi.mock('@renderer/stores/index.js', () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
}))

vi.mock('@renderer/utils/index.js', () => ({
  logger: { info: vi.fn(), catch: vi.fn() },
}))

const mockProtocolList = vi.fn()
const mockProtocolCopy = vi.fn()
const mockProtocolMove = vi.fn()

const createMockFile = (
  name: string,
  type: 'file' | 'directory' = 'file',
  path?: string
): FileInfo => ({
  name,
  type,
  size: 100,
  modifyTime: Date.now(),
  permissions: 'rw-r--r--',
  owner: 'user',
  absolutePath: path ?? `/${name}`,
})

const successListResponse = (files: FileInfo[] = []) => ({
  requestId: 'test',
  success: true as const,
  value: files,
  error: undefined,
})

const successVoidResponse = {
  requestId: 'test',
  success: true as const,
  value: undefined,
  error: undefined,
}

const errorResponse = (code = 'ERR', message = 'fail') => ({
  requestId: 'test',
  success: false as const,
  value: undefined,
  error: { code, message },
})

describe('useFileCopyMove', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRefreshCurrentDirectory.mockResolvedValue(undefined)
    mockAddToast.mockReset()
    mockProtocolList.mockReset()
    mockProtocolCopy.mockReset()
    mockProtocolMove.mockReset()
    vi.stubGlobal('window', {
      electronAPI: {
        protocol: {
          list: mockProtocolList,
          copy: mockProtocolCopy,
          move: mockProtocolMove,
        },
      },
    })
  })

  // 1. handleCopy
  it('handleCopy: sets pendingFiles + pendingOperation=copy + targetFolderDialogOpen=true', () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const files = [createMockFile('a.txt')]

    act(() => {
      result.current.handleCopy(files)
    })

    expect(result.current.pendingFiles).toEqual(files)
    expect(result.current.pendingOperation).toBe('copy')
    expect(result.current.targetFolderDialogOpen).toBe(true)
  })

  // 2. handleMove
  it('handleMove: sets pendingFiles + pendingOperation=move + targetFolderDialogOpen=true', () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const files = [createMockFile('a.txt')]

    act(() => {
      result.current.handleMove(files)
    })

    expect(result.current.pendingFiles).toEqual(files)
    expect(result.current.pendingOperation).toBe('move')
    expect(result.current.targetFolderDialogOpen).toBe(true)
  })

  // 3. handleSelectTargetFolder: no pendingOperation returns INVALID_STATE error
  it('handleSelectTargetFolder: no pendingOperation returns INVALID_STATE error', async () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const targetDir = createMockFile('target', 'directory', '/target')

    let res: unknown
    await act(async () => {
      res = await result.current.handleSelectTargetFolder(targetDir)
    })

    expect(res).toEqual({
      success: false,
      value: null,
      error: { code: 'INVALID_STATE', message: 'error.noOperationPending' },
    })
  })

  // 4. handleSelectTargetFolder: directory moved to self subpath returns SELF_CONTAINED error
  it('handleSelectTargetFolder: directory moved to self subpath returns SELF_CONTAINED error', async () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const dir = createMockFile('mydir', 'directory', '/home/mydir')
    const targetDir = createMockFile('mydir', 'directory', '/home/mydir/sub')

    act(() => {
      result.current.handleMove([dir])
    })

    let res: unknown
    await act(async () => {
      res = await result.current.handleSelectTargetFolder(targetDir)
    })

    expect(res).toEqual({
      success: false,
      value: null,
      error: { code: 'SELF_CONTAINED', message: 'toast.cannotMoveToSelf' },
    })
  })

  // 5. handleSelectTargetFolder: list failure returns LIST_FAILED error
  it('handleSelectTargetFolder: list failure returns LIST_FAILED error', async () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const files = [createMockFile('a.txt')]
    const targetDir = createMockFile('target', 'directory', '/target')

    act(() => {
      result.current.handleCopy(files)
    })

    mockProtocolList.mockResolvedValue(errorResponse('LIST_ERR', 'cannot list'))

    let res: unknown
    await act(async () => {
      res = await result.current.handleSelectTargetFolder(targetDir)
    })

    expect(res).toEqual({
      success: false,
      value: null,
      error: { code: 'LIST_FAILED', message: '{"code":"LIST_ERR","message":"cannot list"}' },
    })
  })

  // 6. handleSelectTargetFolder: conflicts found opens conflictDialog
  it('handleSelectTargetFolder: conflicts found opens conflictDialog', async () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const sourceFile = createMockFile('a.txt', 'file', '/src/a.txt')
    const files = [sourceFile]
    const targetDir = createMockFile('target', 'directory', '/target')
    const targetFile = createMockFile('a.txt', 'file', '/target/a.txt')

    act(() => {
      result.current.handleCopy(files)
    })

    mockProtocolList.mockResolvedValue(successListResponse([targetFile]))

    await act(async () => {
      await result.current.handleSelectTargetFolder(targetDir)
    })

    expect(result.current.conflictDialogOpen).toBe(true)
    expect(result.current.targetFolderDialogOpen).toBe(false)
    expect(result.current.conflicts).toHaveLength(1)
    expect(result.current.conflicts[0]?.sourceFile).toEqual(sourceFile)
    expect(result.current.conflicts[0]?.targetFile).toEqual(targetFile)
    expect(result.current.pendingTargetDir).toEqual(targetDir)
  })

  // 7. handleSelectTargetFolder: no conflicts executes operation directly
  it('handleSelectTargetFolder: no conflicts executes operation directly', async () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const sourceFile = createMockFile('a.txt', 'file', '/src/a.txt')
    const files = [sourceFile]
    const targetDir = createMockFile('target', 'directory', '/target')

    act(() => {
      result.current.handleCopy(files)
    })

    mockProtocolList.mockResolvedValue(successListResponse([]))
    mockProtocolCopy.mockResolvedValue(successVoidResponse)

    let res: unknown
    await act(async () => {
      res = await result.current.handleSelectTargetFolder(targetDir)
    })

    expect(res).toEqual({ success: true, value: undefined, error: null })
    expect(mockProtocolCopy).toHaveBeenCalledWith('test-session', sourceFile, '/target/a.txt')
  })

  // 8. handleSelectTargetFolder: copy success shows success toast
  it('handleSelectTargetFolder: copy success shows success toast', async () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const sourceFile = createMockFile('a.txt', 'file', '/src/a.txt')
    const files = [sourceFile]
    const targetDir = createMockFile('target', 'directory', '/target')

    act(() => {
      result.current.handleCopy(files)
    })

    mockProtocolList.mockResolvedValue(successListResponse([]))
    mockProtocolCopy.mockResolvedValue(successVoidResponse)

    await act(async () => {
      await result.current.handleSelectTargetFolder(targetDir)
    })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      message: 'toast.copySuccess',
    })
  })

  // 9. handleSelectTargetFolder: move success shows success toast
  it('handleSelectTargetFolder: move success shows success toast', async () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const sourceFile = createMockFile('a.txt', 'file', '/src/a.txt')
    const files = [sourceFile]
    const targetDir = createMockFile('target', 'directory', '/target')

    act(() => {
      result.current.handleMove(files)
    })

    mockProtocolList.mockResolvedValue(successListResponse([]))
    mockProtocolMove.mockResolvedValue(successVoidResponse)

    await act(async () => {
      await result.current.handleSelectTargetFolder(targetDir)
    })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      message: 'toast.moveSuccess',
    })
  })

  // 10. handleSelectTargetFolder: copy failure shows error toast
  it('handleSelectTargetFolder: copy failure shows error toast', async () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const sourceFile = createMockFile('a.txt', 'file', '/src/a.txt')
    const files = [sourceFile]
    const targetDir = createMockFile('target', 'directory', '/target')

    act(() => {
      result.current.handleCopy(files)
    })

    mockProtocolList.mockResolvedValue(successListResponse([]))
    mockProtocolCopy.mockResolvedValue(errorResponse('COPY_ERR', 'copy failed'))

    await act(async () => {
      await result.current.handleSelectTargetFolder(targetDir)
    })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      message: 'toast.copyFailed: {"code":"COPY_ERR","message":"copy failed"}',
    })
  })

  // 11. handleSelectTargetFolder: move failure shows error toast
  it('handleSelectTargetFolder: move failure shows error toast', async () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const sourceFile = createMockFile('a.txt', 'file', '/src/a.txt')
    const files = [sourceFile]
    const targetDir = createMockFile('target', 'directory', '/target')

    act(() => {
      result.current.handleMove(files)
    })

    mockProtocolList.mockResolvedValue(successListResponse([]))
    mockProtocolMove.mockResolvedValue(errorResponse('MOVE_ERR', 'move failed'))

    await act(async () => {
      await result.current.handleSelectTargetFolder(targetDir)
    })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      message: 'toast.moveFailed: {"code":"MOVE_ERR","message":"move failed"}',
    })
  })

  // 12. handleConflictResolution: skip strategy skips files
  it('handleConflictResolution: skip strategy skips files', async () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const sourceFile = createMockFile('a.txt', 'file', '/src/a.txt')
    const targetFile = createMockFile('a.txt', 'file', '/target/a.txt')
    const targetDir = createMockFile('target', 'directory', '/target')
    const files = [sourceFile]

    act(() => {
      result.current.handleCopy(files)
    })

    mockProtocolList.mockResolvedValue(successListResponse([targetFile]))

    await act(async () => {
      await result.current.handleSelectTargetFolder(targetDir)
    })

    expect(result.current.conflictDialogOpen).toBe(true)

    const resolutions: ConflictResolution[] = [{ sourceFile, targetFile, strategy: 'skip' }]

    mockProtocolCopy.mockResolvedValue(successVoidResponse)

    await act(async () => {
      await result.current.handleConflictResolution(resolutions)
    })

    // skip means no copy call
    expect(mockProtocolCopy).not.toHaveBeenCalled()
    // still shows success toast since no items to process
    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      message: 'toast.copySuccess',
    })
  })

  // 13. handleConflictResolution: keepBoth strategy generates unique filename
  it('handleConflictResolution: keepBoth strategy generates unique filename', async () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const sourceFile = createMockFile('a.txt', 'file', '/src/a.txt')
    const targetFile = createMockFile('a.txt', 'file', '/target/a.txt')
    const targetDir = createMockFile('target', 'directory', '/target')
    const files = [sourceFile]

    act(() => {
      result.current.handleCopy(files)
    })

    mockProtocolList.mockResolvedValue(successListResponse([targetFile]))

    await act(async () => {
      await result.current.handleSelectTargetFolder(targetDir)
    })

    const resolutions: ConflictResolution[] = [{ sourceFile, targetFile, strategy: 'keepBoth' }]

    mockProtocolCopy.mockResolvedValue(successVoidResponse)

    await act(async () => {
      await result.current.handleConflictResolution(resolutions)
    })

    expect(mockProtocolCopy).toHaveBeenCalledTimes(1)
    const callArgs = mockProtocolCopy.mock.calls[0]
    if (callArgs) {
      const targetPath = callArgs[2] as string
      // Should be /target/a_<timestamp>.txt pattern
      expect(targetPath).toMatch(/^\/target\/a_\d{8}_\d{6}_\d{3}\.txt$/)
    }
  })

  // 14. handleConflictResolution: no pending data cleans state
  it('handleConflictResolution: no pending data cleans state', async () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))

    // Call handleConflictResolution with no pending state
    await act(async () => {
      await result.current.handleConflictResolution([])
    })

    expect(result.current.conflictDialogOpen).toBe(false)
    expect(result.current.pendingOperation).toBeNull()
    expect(result.current.pendingFiles).toEqual([])
    expect(result.current.pendingTargetDir).toBeNull()
    expect(result.current.conflicts).toEqual([])
  })

  // 15. handleConflictResolution: execution cleans all pending state
  it('handleConflictResolution: execution cleans all pending state', async () => {
    const { result } = renderHook(() => useFileCopyMove('test-session'))
    const sourceFile = createMockFile('a.txt', 'file', '/src/a.txt')
    const targetFile = createMockFile('a.txt', 'file', '/target/a.txt')
    const targetDir = createMockFile('target', 'directory', '/target')
    const files = [sourceFile]

    act(() => {
      result.current.handleCopy(files)
    })

    mockProtocolList.mockResolvedValue(successListResponse([targetFile]))

    await act(async () => {
      await result.current.handleSelectTargetFolder(targetDir)
    })

    const resolutions: ConflictResolution[] = [{ sourceFile, targetFile, strategy: 'keepBoth' }]

    mockProtocolCopy.mockResolvedValue(successVoidResponse)

    await act(async () => {
      await result.current.handleConflictResolution(resolutions)
    })

    expect(result.current.conflictDialogOpen).toBe(false)
    expect(result.current.pendingOperation).toBeNull()
    expect(result.current.pendingFiles).toEqual([])
    expect(result.current.pendingTargetDir).toBeNull()
    expect(result.current.conflicts).toEqual([])
  })
})
