import { act, renderHook } from '@testing-library/react'
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
  selectRunningTaskCount: (state: { runningTaskCount?: number }) => state.runningTaskCount ?? 0,
}))

vi.mock('../utils/logger.js', () => ({
  default: { catch: mockLoggerCatch },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (selector: (ns: unknown) => unknown) => {
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
      selector(proxy)
      return path.join('.')
    },
  }),
}))

function setRunning(count: number): void {
  mockUseTransferStore.mockImplementation(
    (selector: (state: { runningTaskCount: number }) => unknown) =>
      selector({ runningTaskCount: count }),
  )
}

describe('useActiveTaskGuard', () => {
  const mockCancelAll = vi.fn().mockResolvedValue({ success: true, value: undefined, error: null })
  const mockConfirmClose = vi.fn().mockResolvedValue({ success: true, value: null, error: null })
  const mockOnCloseRequested = vi.fn(
    (_cb: (payload: { reason: 'close' | 'quit' }) => void) => () => {},
  )

  beforeEach(() => {
    vi.clearAllMocks()
    mockCancelAll.mockResolvedValue({ success: true, value: undefined, error: null })
    mockConfirmClose.mockResolvedValue({ success: true, value: null, error: null })
    mockOnCloseRequested.mockReturnValue(() => {})
    setRunning(0)
    mockGetState.mockReturnValue({ tasks: [] })
    Object.assign(window, {
      electronAPI: {
        transfer: { cancelAll: mockCancelAll },
        app: { confirmClose: mockConfirmClose, onCloseRequested: mockOnCloseRequested },
      },
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'electronAPI')
  })

  it('guard 无活跃任务时直接执行 action', () => {
    const { result } = renderHook(() => useActiveTaskGuard())
    const action = vi.fn()
    act(() => result.current.guard(action))
    expect(action).toHaveBeenCalledTimes(1)
    expect(result.current.confirmOpen).toBe(false)
  })

  it('guard 有活跃任务时弹窗并暂存 action', () => {
    setRunning(1)
    const { result } = renderHook(() => useActiveTaskGuard())
    const action = vi.fn()
    act(() => result.current.guard(action))
    expect(action).not.toHaveBeenCalled()
    expect(result.current.confirmOpen).toBe(true)
  })

  it('断开连接确认：cancelAll + pendingAction', async () => {
    setRunning(1)
    mockGetState.mockReturnValue({
      tasks: [{ sessionId: 'sess-1', status: OPERATION_STATUS.RUNNING }],
    })
    const { result } = renderHook(() => useActiveTaskGuard())
    const action = vi.fn()
    act(() => result.current.guard(action, 'sess-1'))

    await act(async () => result.current.handleConfirm())

    expect(mockCancelAll).toHaveBeenCalledWith('sess-1')
    expect(action).toHaveBeenCalledTimes(1)
    expect(mockConfirmClose).not.toHaveBeenCalled()
    expect(result.current.confirmOpen).toBe(false)
  })

  it('关闭窗口事件：取消全部任务后调 app.confirmClose', async () => {
    setRunning(1)
    let captured: ((payload: { reason: 'close' | 'quit' }) => void) | null = null
    mockOnCloseRequested.mockImplementation((cb) => {
      captured = cb
      return () => {}
    })
    const { result } = renderHook(() => useActiveTaskGuard())

    act(() => captured?.({ reason: 'close' }))
    expect(result.current.confirmOpen).toBe(true)
    expect(result.current.pendingReason).toBe('close')
    expect(result.current.title).toBe('transfer.confirmClose.title')

    await act(async () => result.current.handleConfirm())

    expect(mockCancelAll).toHaveBeenCalledWith(undefined)
    expect(mockConfirmClose).toHaveBeenCalledTimes(1)
    expect(result.current.confirmOpen).toBe(false)
  })

  it('退出事件使用 confirmQuit 文案', () => {
    setRunning(1)
    let captured: ((payload: { reason: 'close' | 'quit' }) => void) | null = null
    mockOnCloseRequested.mockImplementation((cb) => {
      captured = cb
      return () => {}
    })
    const { result } = renderHook(() => useActiveTaskGuard())

    act(() => captured?.({ reason: 'quit' }))

    expect(result.current.pendingReason).toBe('quit')
    expect(result.current.title).toBe('transfer.confirmQuit.title')
  })

  it('cancelAll reject 时不上报未处理 rejection，状态仍 reset', async () => {
    setRunning(1)
    mockGetState.mockReturnValue({
      tasks: [{ sessionId: 'sess-1', status: OPERATION_STATUS.RUNNING }],
    })
    const cancelError = new Error('cancel failed')
    mockCancelAll.mockRejectedValueOnce(cancelError)
    const { result } = renderHook(() => useActiveTaskGuard())
    const action = vi.fn()
    act(() => result.current.guard(action, 'sess-1'))

    await act(async () => result.current.handleConfirm())

    expect(action).not.toHaveBeenCalled()
    expect(mockLoggerCatch).toHaveBeenCalledWith(cancelError, {
      action: 'useActiveTaskGuard.handleConfirm',
    })
    expect(result.current.confirmOpen).toBe(false)
  })

  it('handleConfirm 无任何 pending 时也安全返回', async () => {
    const { result } = renderHook(() => useActiveTaskGuard())
    await act(async () => result.current.handleConfirm())
    expect(mockCancelAll).toHaveBeenCalledWith(undefined)
    expect(mockConfirmClose).not.toHaveBeenCalled()
  })

  it('handleCancel 重置状态', () => {
    setRunning(1)
    const { result } = renderHook(() => useActiveTaskGuard())
    act(() => result.current.guard(() => {}))
    expect(result.current.confirmOpen).toBe(true)

    act(() => result.current.handleCancel())
    expect(result.current.confirmOpen).toBe(false)
    expect(result.current.pendingReason).toBeNull()
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

  it('mount 时订阅 app.closeRequested 并在卸载时取消', () => {
    const unsubscribe = vi.fn()
    mockOnCloseRequested.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useActiveTaskGuard())

    expect(mockOnCloseRequested).toHaveBeenCalledTimes(1)
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
