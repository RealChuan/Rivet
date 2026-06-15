/**
 * WindowFactory — 无边框窗口工厂
 *
 * 所有 Rivet 窗口（主窗口、子窗口、对话框）的统一创建入口。
 * 自动应用平台适配的无边框配置，复用同一套 Preload 脚本。
 */

import { app, BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import {
  DEFAULT_CHILD_WINDOW_HEIGHT,
  DEFAULT_CHILD_WINDOW_MIN_HEIGHT,
  DEFAULT_CHILD_WINDOW_MIN_WIDTH,
  DEFAULT_CHILD_WINDOW_WIDTH,
  DEV_SERVER_URL,
  MACOS_TRAFFIC_LIGHT_POSITION,
  APP_NAME,
} from '@shared/constants/index.js'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { supportsGlassEffect } from '../utils/index.js'
import { registerWindowMeta, unregisterWindowMeta } from '../utils/window-meta.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// ============================================================
// 类型定义
// ============================================================

export interface FramelessWindowOptions {
  /** 窗口唯一标识，用于 IPC 区分和 WindowManager 管理 */
  id: string
  /** 渲染进程路由路径，如 '/' 或 '/settings' */
  route?: string
  /** 窗口标题 */
  title?: string
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  /** 父窗口（设置此项可创建模态对话框） */
  parent?: BrowserWindow
  /** 是否为模态窗口 */
  modal?: boolean
  /** 是否置顶 */
  alwaysOnTop?: boolean
  /** 是否可调整大小 */
  resizable?: boolean
  /** 是否显示（默认 false，等待 ready-to-show） */
  show?: boolean
}

// ============================================================
// 窗口工厂
// ============================================================

/**
 * 创建无边框窗口
 *
 * 平台差异：
 * - macOS: titleBarStyle='hidden' + frame=true，保留系统交通灯按钮
 * - Windows/Linux: frame=false，完全由 React 接管标题栏
 */
export function createFramelessWindow(options: FramelessWindowOptions): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const isWindows = process.platform === 'win32'
  const supportsGlass = supportsGlassEffect()

  const browserOptions: BrowserWindowConstructorOptions = {
    width: options.width ?? DEFAULT_CHILD_WINDOW_WIDTH,
    height: options.height ?? DEFAULT_CHILD_WINDOW_HEIGHT,
    minWidth: options.minWidth ?? DEFAULT_CHILD_WINDOW_MIN_WIDTH,
    minHeight: options.minHeight ?? DEFAULT_CHILD_WINDOW_MIN_HEIGHT,
    title: options.title ?? APP_NAME,

    // ========== 无边框核心配置 ==========
    titleBarStyle: 'hidden',
    frame: isMac,
    ...(isMac ? { trafficLightPosition: MACOS_TRAFFIC_LIGHT_POSITION } : {}),

    // ========== 毛玻璃效果（仅支持原生毛玻璃的平台） ==========
    ...(isMac && supportsGlass ? { vibrancy: 'under-window' } : {}),
    ...(isWindows && supportsGlass ? { backgroundMaterial: 'acrylic' } : {}),

    // 窗口行为
    show: options.show ?? false,
    resizable: options.resizable ?? true,
    alwaysOnTop: options.alwaysOnTop ?? false,
    parent: options.parent as BrowserWindow,
    modal: options.modal ?? false,

    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  }

  const win = new BrowserWindow(browserOptions)

  // ========== 窗口状态事件转发（带窗口ID）==========
  win.on('maximize', () => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.WINDOW.STATE_CHANGED, {
        windowId: options.id,
        isMaximized: true,
      })
    }
  })

  win.on('unmaximize', () => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.WINDOW.STATE_CHANGED, {
        windowId: options.id,
        isMaximized: false,
      })
    }
  })

  // ========== 加载页面 ==========
  const route = options.route ?? '/'

  if (!app.isPackaged) {
    void win.loadURL(`${DEV_SERVER_URL}${route ? `#${route}` : ''}`)
  } else {
    void win.loadFile(path.join(__dirname, '../../renderer/index.html'), {
      hash: route,
    })
  }

  // ========== 安全：阻止导航和打开新窗口 ==========
  win.webContents.on('will-navigate', event => {
    event.preventDefault()
  })

  win.webContents.setWindowOpenHandler(() => ({
    action: 'deny',
  }))

  // 防止闪烁：等页面 ready 后再显示
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  return win
}

// ============================================================
// WindowManager — 窗口生命周期管理
// ============================================================

const windowMap = new Map<string, BrowserWindow>()

export const WindowManager = {
  /**
   * 创建并注册窗口
   */
  create(options: FramelessWindowOptions): BrowserWindow {
    const existing = windowMap.get(options.id)
    if (existing && !existing.isDestroyed()) {
      existing.focus()
      return existing
    }

    const win = createFramelessWindow(options)
    windowMap.set(options.id, win)

    registerWindowMeta(win, options.id, options.route ?? '/')

    win.on('closed', () => {
      windowMap.delete(options.id)
      unregisterWindowMeta(win)
    })

    return win
  },

  /**
   * 通过 ID 获取窗口
   */
  get(id: string): BrowserWindow | undefined {
    const win = windowMap.get(id)
    return win && !win.isDestroyed() ? win : undefined
  },

  /**
   * 通过 ID 关闭窗口
   */
  close(id: string): void {
    const win = windowMap.get(id)
    if (win && !win.isDestroyed()) {
      win.close()
    }
    windowMap.delete(id)
  },

  /**
   * 获取所有存活窗口
   */
  getAll(): BrowserWindow[] {
    return Array.from(windowMap.values()).filter(w => !w.isDestroyed())
  },

  /**
   * 向所有存活窗口广播 IPC 消息
   */
  broadcast(
    channel: (typeof IPC_CHANNELS.EVENTS)[keyof typeof IPC_CHANNELS.EVENTS],
    ...args: unknown[]
  ): void {
    windowMap.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...(args as Parameters<typeof win.webContents.send>))
      }
    })
  },
} as const
