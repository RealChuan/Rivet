/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
/* eslint-disable @typescript-eslint/no-unsafe-return -- mock 透传 any 参数 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- mock 透传 any 参数 */
import { app, type BrowserWindow } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENT_CHANNEL } from '@shared/contract/events.contract.js'

const mockHasActiveTasks = vi.fn(() => false)
const mockGetMainWindow = vi.fn<() => BrowserWindow | undefined>(() => undefined)
const mockWarn = vi.fn()

vi.mock('../services/transfer/index.js', () => ({
  transferService: { hasActiveTasks: () => mockHasActiveTasks() },
}))

vi.mock('./main-window.js', () => ({
  getMainWindow: () => mockGetMainWindow(),
}))

vi.mock('../utils/index.js', () => ({
  logger: { warn: (...args: unknown[]) => mockWarn(...args) },
}))

function fakeWindow(): BrowserWindow {
  const win: BrowserWindow = Object.create(null)
  win.isDestroyed = () => false
  win.close = vi.fn()
  Object.defineProperty(win, 'webContents', { value: { send: vi.fn() } })
  return win
}

describe('close-guard', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockHasActiveTasks.mockReturnValue(false)
    mockGetMainWindow.mockReturnValue(undefined)
    const { resetCloseGuard } = await import('./close-guard.js')
    resetCloseGuard()
  })

  it('does not intercept when there are no active tasks', async () => {
    const { requestClose } = await import('./close-guard.js')
    expect(requestClose(fakeWindow(), 'close')).toBe(false)
  })

  it('sends close intent to the renderer when tasks are active', async () => {
    const { requestClose } = await import('./close-guard.js')
    mockHasActiveTasks.mockReturnValue(true)
    const win = fakeWindow()

    expect(requestClose(win, 'close')).toBe(true)
    expect(win.webContents.send).toHaveBeenCalledWith(EVENT_CHANNEL.CLOSE_REQUESTED, {
      reason: 'close',
    })
  })

  it('does not block quit when there is no live window to ask', async () => {
    const { requestClose } = await import('./close-guard.js')
    mockHasActiveTasks.mockReturnValue(true)

    expect(requestClose(undefined, 'quit')).toBe(false)
    expect(mockWarn).toHaveBeenCalled()
  })

  it('confirmClose quits for quit intent', async () => {
    const { confirmClose, requestClose } = await import('./close-guard.js')
    mockHasActiveTasks.mockReturnValue(true)
    requestClose(fakeWindow(), 'quit')

    confirmClose()

    expect(app.quit).toHaveBeenCalled()
  })

  it('confirmClose closes the window for close intent', async () => {
    const { confirmClose, requestClose } = await import('./close-guard.js')
    mockHasActiveTasks.mockReturnValue(true)
    const win = fakeWindow()
    mockGetMainWindow.mockReturnValue(win)
    requestClose(win, 'close')

    confirmClose()

    expect(win.close).toHaveBeenCalled()
  })

  it('confirmed guard does not intercept again until reset', async () => {
    const { confirmClose, isCloseConfirmed, requestClose, resetCloseGuard } =
      await import('./close-guard.js')
    mockHasActiveTasks.mockReturnValue(true)
    const win = fakeWindow()
    mockGetMainWindow.mockReturnValue(win)
    requestClose(win, 'close')
    confirmClose()

    expect(isCloseConfirmed()).toBe(true)
    expect(requestClose(win, 'close')).toBe(false)

    resetCloseGuard()
    expect(requestClose(win, 'close')).toBe(true)
  })
})
