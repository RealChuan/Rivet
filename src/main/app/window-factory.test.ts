/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
/* eslint-disable @typescript-eslint/no-unsafe-return -- mock 工厂透传 any 参数 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- globalThis 注入 Vite 全局 */
/* eslint-disable @typescript-eslint/consistent-type-imports -- typeof import() 用于取模块类型 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetMainWindow = vi.fn()

vi.mock('./main-window.js', () => ({
  getMainWindow: () => mockGetMainWindow(),
}))

vi.mock('./window-chrome.js', () => ({
  getWindowChromeMode: vi.fn(() => 'wco'),
}))

vi.mock('../utils/index.js', () => ({
  supportsGlassEffect: vi.fn(() => false),
}))

describe('window-factory', () => {
  let createAppWindow: typeof import('./window-factory.js').createAppWindow
  let createUtilityWindow: typeof import('./window-factory.js').createUtilityWindow
  let BrowserWindow: typeof import('electron').BrowserWindow
  let getWindowChromeMode: typeof import('./window-chrome.js').getWindowChromeMode

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetMainWindow.mockReturnValue(undefined)
    ;(globalThis as Record<string, unknown>).MAIN_WINDOW_VITE_DEV_SERVER_URL = ''
    ;(globalThis as Record<string, unknown>).MAIN_WINDOW_VITE_NAME = 'main_window'
    const module = await import('./window-factory.js')
    createAppWindow = module.createAppWindow
    createUtilityWindow = module.createUtilityWindow
    BrowserWindow = (await import('electron')).BrowserWindow
    getWindowChromeMode = (await import('./window-chrome.js')).getWindowChromeMode
    vi.mocked(getWindowChromeMode).mockReturnValue('wco')
  })

  it('creates the main window hidden until ready', () => {
    const win = createAppWindow()

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        titleBarStyle: 'hidden',
        show: false,
        webPreferences: expect.objectContaining({
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        }),
      }),
    )
    expect(win.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function))
  })

  it('adds WCO overlay and chrome argument on Windows 11', () => {
    createAppWindow('dark')

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        titleBarStyle: 'hidden',
        titleBarOverlay: expect.objectContaining({ height: 36 }),
        webPreferences: expect.objectContaining({
          additionalArguments: ['--rivet-window-chrome=wco'],
        }),
      }),
    )
  })

  it('resolves preload and renderer paths from the app root', async () => {
    const { app } = await import('electron')
    const path = (await import('node:path')).default
    const win = createAppWindow('light')

    expect(vi.mocked(app.getAppPath)).toHaveBeenCalled()
    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          preload: path.join('/app', '.vite', 'build', 'index.cjs'),
        }),
      }),
    )
    expect(win.loadFile).toHaveBeenCalledWith(
      path.join('/app', '.vite', 'renderer', 'main_window', 'index.html'),
      undefined,
    )
  })

  it('uses the frameless custom titlebar on Windows 10 and Linux', () => {
    vi.mocked(getWindowChromeMode).mockReturnValue('custom')
    createAppWindow('light')

    const options = vi.mocked(BrowserWindow).mock.calls.at(-1)?.[0]
    expect(options).not.toHaveProperty('titleBarStyle')
    expect(options).not.toHaveProperty('titleBarOverlay')
    expect(options?.frame).toBe(false)
    expect(options?.backgroundColor).toBe('#ffffff')
    expect(options?.webPreferences).toEqual(
      expect.objectContaining({ additionalArguments: ['--rivet-window-chrome=custom'] }),
    )
  })

  it('uses traffic lights and no overlay on macOS', () => {
    vi.mocked(getWindowChromeMode).mockReturnValue('mac-hidden')
    createAppWindow('light')

    const options = vi.mocked(BrowserWindow).mock.calls.at(-1)?.[0]
    expect(options).toEqual(
      expect.objectContaining({
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 16, y: 12 },
      }),
    )
    expect(options).not.toHaveProperty('titleBarOverlay')
  })

  it('blocks navigation and new windows', () => {
    const win = createAppWindow()

    expect(win.webContents.on).toHaveBeenCalledWith('will-navigate', expect.any(Function))
    expect(win.webContents.setWindowOpenHandler).toHaveBeenCalled()
  })

  it('creates a fixed-size modal utility window with the route hash', () => {
    const parent = { isDestroyed: () => false }
    mockGetMainWindow.mockReturnValue(parent)

    const win = createUtilityWindow({ route: '/settings', width: 300, height: 200, title: 'T' })

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 300,
        height: 200,
        resizable: false,
        maximizable: false,
        modal: true,
        parent,
      }),
    )
    expect(win.loadFile).toHaveBeenCalledWith(expect.any(String), { hash: '/settings' })
  })
})
