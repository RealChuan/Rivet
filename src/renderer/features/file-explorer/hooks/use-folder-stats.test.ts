import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { protocolApi } from '../../../api/protocol.js'
import { useFolderStats } from './use-folder-stats.js'

const calculateMock = vi.mocked(protocolApi.calculateFolderStats)
const cancelMock = vi.mocked(protocolApi.cancelCalculateFolderStats)
const subscribeMock = vi.mocked(protocolApi.onFolderStatsProgress)

let emitProgress: (data: Parameters<Parameters<typeof subscribeMock>[0]>[0]) => void = () => {}

vi.mock('../../../api/protocol.js', () => ({
  protocolApi: {
    calculateFolderStats: vi.fn(),
    cancelCalculateFolderStats: vi.fn(),
    onFolderStatsProgress: vi.fn(),
  },
}))

const PROGRESS = {
  fileCount: 0,
  folderCount: 0,
  totalSize: 0,
  currentPath: '/',
  errorCount: 0,
  isComplete: false,
  isCancelled: false,
}

beforeEach(() => {
  calculateMock.mockReset().mockResolvedValue(undefined)
  cancelMock.mockReset().mockResolvedValue(undefined)
  subscribeMock.mockReset().mockImplementation((callback) => {
    emitProgress = callback
    return () => {}
  })
})

describe('useFolderStats', () => {
  it('start 后把 sessionId/path 传给主进程', () => {
    const { result } = renderHook(() =>
      useFolderStats({ sessionId: 's1', path: '/a', enabled: true }),
    )

    act(() => result.current.start())

    expect(calculateMock).toHaveBeenCalledWith('s1', '/a')
    expect(result.current.isCalculating).toBe(true)
  })

  it('只接受当前 session 的进度事件', () => {
    const { result } = renderHook(() =>
      useFolderStats({ sessionId: 's1', path: '/a', enabled: true }),
    )

    act(() => emitProgress({ ...PROGRESS, sessionId: 's2', fileCount: 9 }))
    expect(result.current.progress).toBeNull()

    act(() => emitProgress({ ...PROGRESS, sessionId: 's1', fileCount: 2 }))
    expect(result.current.progress).toMatchObject({ fileCount: 2 })
  })

  it('isComplete 终止计算态', () => {
    const { result } = renderHook(() =>
      useFolderStats({ sessionId: 's1', path: '/a', enabled: true }),
    )

    act(() => result.current.start())
    act(() => emitProgress({ ...PROGRESS, sessionId: 's1', isComplete: true }))

    expect(result.current.isCalculating).toBe(false)
  })

  it('cancel 调用主进程取消', () => {
    const { result } = renderHook(() =>
      useFolderStats({ sessionId: 's1', path: '/a', enabled: true }),
    )

    act(() => result.current.start())
    act(() => result.current.cancel())

    expect(cancelMock).toHaveBeenCalledWith('s1')
    expect(result.current.isCalculating).toBe(false)
  })

  it('卸载时取消进行中的统计', () => {
    const { result, unmount } = renderHook(() =>
      useFolderStats({ sessionId: 's1', path: '/a', enabled: true }),
    )

    act(() => result.current.start())
    unmount()

    expect(cancelMock).toHaveBeenCalledWith('s1')
  })

  it('失败时记录错误并停止计算', async () => {
    calculateMock.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() =>
      useFolderStats({ sessionId: 's1', path: '/a', enabled: true }),
    )

    act(() => {
      result.current.start()
    })
    await waitFor(() => expect(result.current.error).toBe('boom'))

    expect(result.current.isCalculating).toBe(false)
  })
})
