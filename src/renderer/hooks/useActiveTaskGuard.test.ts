import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OPERATION_STATUS } from '@shared/constants/transfer.js'
import { useActiveTaskGuard } from './use-active-task-guard.js'

const { mockUseTransferStore, mockGetState, mockLoggerCatch } = vi.hoisted(() => {
  const mockGetState = vi.fn(() => ({ tasks: [] as Array<{ sessionId: string; status: string }> }))
  const mockUseTransferStore = Object.assign(vi.fn(), { getState: mockGetState })
  const mockLoggerCatch = vi.fn()
  return { mockUseTransferStore, mockGetState, mockLoggerCatch }
})

vi.mock('../features/transfer/stores/transfer.js', () => ({
  useTransferStore: mockUseTransferStore,
}))

vi.mock('../utils/logger.js', () => ({
  default: { catch: mockLoggerCatch },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (keyOrSelector: string | ((ns: unknown) => unknown)) => {
      if (typeof keyOrSelector === 'function') {
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
        keyOrSelector(proxy)
        return path.join('.')
      }
      return keyOrSelector
    },
  }),
}))

describe('useActiveTaskGuard', () => {
  const mockCancelAll = vi.fn().mockResolvedValue(undefined)
  const mockOnHasActiveTasks = vi.fn((_cb: () => void) => () => {})
  const mockQuit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockCancelAll.mockResolvedValue(undefined)
    mockOnHasActiveTasks.mockReturnValue(() => {})
    mockUseTransferStore.mockImplementation(
      (selector: (state: { runningTaskCount: number }) => unknown) =>
        selector({ runningTaskCount: 0 }),
    )
    mockGetState.mockReturnValue({ tasks: [] })
    Object.assign(window, {
      electronAPI: {
        transfer: {
          cancelAll: mockCancelAll,
          onHasActiveTasks: mockOnHasActiveTasks,
        },
        window: { quit: mockQuit },
      },
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'electronAPI')
  })

  it('guard 无活跃任务时直接执行 action', () => {
    const { result } = renderHook(() => useActiveTaskGuard())
    const action = vi.fn()
    act(() => {
      result.current.guard(action)
    })
    expect(action).toHaveBeenCalledTimes(1)
    expect(result.current.confirmOpen).toBe(false)
  })

  it('guard 有活跃任务时弹窗并暂存 action', () => {
    mockUseTransferStore.mockImplementation(
      (selector: (state: { runningTaskCount: number }) => unknown) =>
        selector({ runningTaskCount: 1 }),
    )
    const { result } = renderHook(() => useActiveTaskGuard())
    const action = vi.fn()
    act(() => {
      result.current.guard(action)
    })
    expect(action).not.toHaveBeenCalled()
    expect(result.current.confirmOpen).toBe(true)
  })

  it('handleConfirm 成功路径：调用 cancelAll、pendingAction 并重置状态', async () => {
    mockUseTransferStore.mockImplementation(
      (selector: (state: { runningTaskCount: number }) => unknown) =>
        selector({ runningTaskCount: 1 }),
    )
    mockGetState.mockReturnValue({
      tasks: [{ sessionId: 'sess-1', status: OPERATION_STATUS.RUNNING }],
    })
    const { result } = renderHook(() => useActiveTaskGuard())
    const action = vi.fn()
    act(() => {
      result.current.guard(action, 'sess-1')
    })
    expect(result.current.confirmOpen).toBe(true)

    await act(async () => {
      await result.current.handleConfirm()
    })

    expect(mockCancelAll).toHaveBeenCalledWith('sess-1')
    expect(action).toHaveBeenCalledTimes(1)
    expect(result.current.confirmOpen).toBe(false)
    expect(mockLoggerCatch).not.toHaveBeenCalled()
  })

  it('cancelAll reject 时状态仍 reset', async () => {
    mockUseTransferStore.mockImplementation(
      (selector: (state: { runningTaskCount: number }) => unknown) =>
        selector({ runningTaskCount: 1 }),
    )
    mockGetState.mockReturnValue({
      tasks: [{ sessionId: 'sess-1', status: OPERATION_STATUS.RUNNING }],
    })
    const cancelError = new Error('cancel failed')
    mockCancelAll.mockRejectedValueOnce(cancelError)

    const { result } = renderHook(() => useActiveTaskGuard())
    const action = vi.fn()
    act(() => {
      result.current.guard(action, 'sess-1')
    })
    expect(result.current.confirmOpen).toBe(true)

    await act(async () => {
      await result.current.handleConfirm()
    })

    // cancelAll 被调用
    expect(mockCancelAll).toHaveBeenCalledWith('sess-1')
    // 失败时 pendingAction 不应执行
    expect(action).not.toHaveBeenCalled()
    // 错误上报主进程
    expect(mockLoggerCatch).toHaveBeenCalledTimes(1)
    expect(mockLoggerCatch).toHaveBeenCalledWith(cancelError, {
      action: 'useActiveTaskGuard.handleConfirm',
    })
    // 状态被重置，无脏状态
    expect(result.current.confirmOpen).toBe(false)
  })

  it('cancelAll reject 时不应产生未处理 rejection', async () => {
    mockUseTransferStore.mockImplementation(
      (selector: (state: { runningTaskCount: number }) => unknown) =>
        selector({ runningTaskCount: 1 }),
    )
    mockCancelAll.mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() => useActiveTaskGuard())
    const action = vi.fn()
    act(() => {
      result.current.guard(action)
    })

    // handleConfirm 应正常 resolve 而非抛出
    await expect(
      (async () => {
        await act(async () => {
          await result.current.handleConfirm()
        })
      })(),
    ).resolves.not.toThrow()
  })

  it('handleConfirm 无 pendingAction 时直接返回', async () => {
    const { result } = renderHook(() => useActiveTaskGuard())
    await act(async () => {
      await result.current.handleConfirm()
    })
    expect(mockCancelAll).not.toHaveBeenCalled()
  })

  it('handleCancel 重置状态', () => {
    mockUseTransferStore.mockImplementation(
      (selector: (state: { runningTaskCount: number }) => unknown) =>
        selector({ runningTaskCount: 1 }),
    )
    const { result } = renderHook(() => useActiveTaskGuard())
    const action = vi.fn()
    act(() => {
      result.current.guard(action)
    })
    expect(result.current.confirmOpen).toBe(true)

    act(() => {
      result.current.handleCancel()
    })
    expect(result.current.confirmOpen).toBe(false)
  })

  it('hasActiveTasks 按 sessionId 检查 tasks 状态', () => {
    mockGetState.mockReturnValue({
      tasks: [
        { sessionId: 'sess-1', status: OPERATION_STATUS.RUNNING },
        { sessionId: 'sess-2', status: OPERATION_STATUS.COMPLETED },
      ],
    })
    const { result } = renderHook(() => useActiveTaskGuard())
    expect(result.current.hasActiveTasks('sess-1')).toBe(true)
    expect(result.current.hasActiveTasks('sess-2')).toBe(false)
  })

  it('mount 时订阅 onHasActiveTasks 并在触发时调用 guard', () => {
    let captured: (() => void) | null = null
    const unsubscribe = vi.fn()
    mockOnHasActiveTasks.mockImplementation((cb: () => void) => {
      captured = cb
      return unsubscribe
    })

    const { unmount } = renderHook(() => useActiveTaskGuard())

    expect(mockOnHasActiveTasks).toHaveBeenCalledTimes(1)
    expect(captured).not.toBeNull()

    act(() => {
      if (captured) captured()
    })
    // 无活跃任务时直接 quit
    expect(mockQuit).toHaveBeenCalledTimes(1)

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('等待 handleConfirm 完成后状态重置（waitFor 验证异步）', async () => {
    mockUseTransferStore.mockImplementation(
      (selector: (state: { runningTaskCount: number }) => unknown) =>
        selector({ runningTaskCount: 1 }),
    )
    const { result } = renderHook(() => useActiveTaskGuard())
    const action = vi.fn()
    act(() => {
      result.current.guard(action)
    })

    act(() => {
      void result.current.handleConfirm()
    })

    await waitFor(() => {
      expect(result.current.confirmOpen).toBe(false)
    })
    expect(action).toHaveBeenCalledTimes(1)
  })
})
