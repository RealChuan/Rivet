import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TitleBar } from './TitleBar.js'

describe('TitleBar component', () => {
  it('should export TitleBar component', () => {
    expect(typeof TitleBar).toBe('function')
  })
})

// 窗口状态订阅：异步 init 竞态测试
describe('TitleBar window state subscription', () => {
  let mockGetState: ReturnType<typeof vi.fn>
  let mockOnStateChange: ReturnType<typeof vi.fn>
  let originalElectronAPI: unknown

  beforeEach(() => {
    originalElectronAPI = (window as unknown as { electronAPI?: unknown }).electronAPI
    mockGetState = vi.fn()
    mockOnStateChange = vi.fn(() => vi.fn()) // 返回 unsubscribe 函数
    ;(window as unknown as Record<string, unknown>).electronAPI = {
      window: {
        getState: mockGetState,
        onStateChange: mockOnStateChange,
        minimize: vi.fn(),
        maximize: vi.fn(),
        close: vi.fn(),
        quit: vi.fn(),
      },
    }
  })

  afterEach(() => {
    // 还原 window.electronAPI，避免污染其他测试
    ;(window as unknown as { electronAPI?: unknown }).electronAPI = originalElectronAPI
    vi.restoreAllMocks()
  })

  it('异步 resolve 前卸载不泄漏订阅', async () => {
    // 控制 getState 返回的 Promise，手动 resolve 以模拟慢速 IPC
    let resolveGetState!: (value: { isMaximized: boolean; platform: string }) => void
    mockGetState.mockReturnValue(
      new Promise<{ isMaximized: boolean; platform: string }>((resolve) => {
        resolveGetState = resolve
      }),
    )

    const { unmount } = render(<TitleBar />)

    // 此时 init 中的 await 尚未 resolve，onStateChange 不应被注册
    expect(mockOnStateChange).not.toHaveBeenCalled()

    // 在 await resolve 前卸载组件 —— 触发 cleanup，设置 cancelled = true
    unmount()

    // 仍未注册订阅
    expect(mockOnStateChange).not.toHaveBeenCalled()

    // resolve Promise：cancelled 标志应阻止注册 onStateChange
    resolveGetState({ isMaximized: true, platform: 'win32' })
    // 刷新微任务队列，让 await 之后的代码执行
    await Promise.resolve()
    await Promise.resolve()

    expect(mockOnStateChange).not.toHaveBeenCalled()
  })

  it('正常挂载时注册订阅并在卸载时清理', async () => {
    mockGetState.mockResolvedValue({ isMaximized: false, platform: 'win32' })

    const { unmount } = render(<TitleBar />)

    // 等待异步 init 完成
    await vi.waitFor(() => {
      expect(mockOnStateChange).toHaveBeenCalledTimes(1)
    })

    const unsubscribe = mockOnStateChange.mock.results[0]?.value as ReturnType<typeof vi.fn>
    expect(typeof unsubscribe).toBe('function')

    unmount()

    // 卸载时应调用 unsubscribe 清理监听器
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
