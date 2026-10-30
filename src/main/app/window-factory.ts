import { app, BrowserWindow, nativeTheme, type BrowserWindowConstructorOptions } from 'electron'
import path from 'node:path'
import {
  APP_NAME,
  DEFAULT_MAIN_WINDOW_HEIGHT,
  DEFAULT_MAIN_WINDOW_WIDTH,
  DIALOG_SIZE,
  MACOS_TRAFFIC_LIGHT_POSITION,
  MIN_MAIN_WINDOW_HEIGHT,
  MIN_MAIN_WINDOW_WIDTH,
  TITLEBAR_HEIGHT,
  TITLEBAR_OVERLAY_COLORS,
  type Theme,
} from '@shared/constants/index.js'
import { EVENT_CHANNEL } from '@shared/contract/events.contract.js'
import { supportsGlassEffect } from '../utils/index.js'
import { getMainWindow } from './main-window.js'
import { getWindowChromeMode } from './window-chrome.js'

export interface UtilityWindowOptions {
  route: string
  width?: number
  height?: number
  title?: string
}

/**
 * 以 app 根为基准解析产物路径：开发态是项目根，打包后是 app.asar。
 * 不能用 __dirname —— 主进程以 ESM 输出，构建期固化会在打包后指向构建机的绝对路径。
 */
function resolveAppPath(...segments: string[]): string {
  return path.join(app.getAppPath(), ...segments)
}

function loadRenderer(win: BrowserWindow, route?: string): void {
  const hash = route ? `#${route.replace(/^#/, '')}` : ''
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void win.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}${hash}`)
    return
  }
  void win.loadFile(
    resolveAppPath('.vite', 'renderer', MAIN_WINDOW_VITE_NAME, 'index.html'),
    hash ? { hash: hash.slice(1) } : undefined,
  )
}

function hardenWebContents(win: BrowserWindow): void {
  win.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
}

function showWhenReady(win: BrowserWindow): void {
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })
}

/**
 * 唯一主窗口。WCO 只在 Windows 11 启用；macOS 用 hidden titlebar + 红绿灯；
 * Windows 10/Linux 用原生 frame。
 */
export function createAppWindow(theme: Theme = 'system'): BrowserWindow {
  const chrome = getWindowChromeMode()
  const supportsGlass = supportsGlassEffect()
  const dark = theme === 'dark' || (theme === 'system' && nativeTheme.shouldUseDarkColors)

  const chromeOptions: BrowserWindowConstructorOptions =
    chrome === 'wco'
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            ...TITLEBAR_OVERLAY_COLORS[dark ? 'dark' : 'light'],
            height: TITLEBAR_HEIGHT,
          },
          ...(supportsGlass ? { backgroundMaterial: 'acrylic' as const } : {}),
        }
      : chrome === 'mac-hidden'
        ? {
            titleBarStyle: 'hidden',
            trafficLightPosition: MACOS_TRAFFIC_LIGHT_POSITION,
            ...(supportsGlass ? { vibrancy: 'under-window' as const } : {}),
          }
        : {}

  const options: BrowserWindowConstructorOptions = {
    width: DEFAULT_MAIN_WINDOW_WIDTH,
    height: DEFAULT_MAIN_WINDOW_HEIGHT,
    minWidth: MIN_MAIN_WINDOW_WIDTH,
    minHeight: MIN_MAIN_WINDOW_HEIGHT,
    title: APP_NAME,
    frame: chrome === 'custom' ? false : true,
    backgroundColor: chrome === 'custom' ? (dark ? '#1e1e1e' : '#ffffff') : '#00000000',
    ...chromeOptions,
    show: false,
    webPreferences: {
      preload: resolveAppPath('.vite', 'build', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--rivet-window-chrome=${chrome}`],
    },
  }

  const win = new BrowserWindow(options)

  const sendState = (): void => {
    if (!win.isDestroyed()) {
      win.webContents.send(EVENT_CHANNEL.WINDOW_STATE_CHANGED, { isMaximized: win.isMaximized() })
    }
  }
  win.on('maximize', sendState)
  win.on('unmaximize', sendState)

  loadRenderer(win)
  hardenWebContents(win)
  showWhenReady(win)

  return win
}

/**
 * D3 逃生舱：只给未来确实需要原生子窗口时使用。
 * 不注册窗口表、不暴露 IPC。
 */
export function createUtilityWindow(options: UtilityWindowOptions): BrowserWindow {
  const parent = getMainWindow()
  const size = DIALOG_SIZE.STANDARD
  const win = new BrowserWindow({
    width: options.width ?? size.width,
    height: options.height ?? size.height,
    title: options.title ?? APP_NAME,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    modal: true,
    ...(parent ? { parent } : {}),
    show: false,
    webPreferences: {
      preload: resolveAppPath('.vite', 'build', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  loadRenderer(win, options.route)
  hardenWebContents(win)
  showWhenReady(win)

  return win
}
