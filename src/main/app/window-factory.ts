/**
 * WindowFactory — 无边框窗口工厂
 *
 * 所有 Rivet 窗口（主窗口、子窗口、对话框）的统一创建入口。
 * 自动应用平台适配的无边框配置，复用同一套 Preload 脚本。
 */

import { BrowserWindow, app, type BrowserWindowConstructorOptions } from 'electron'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'
import { registerWindowMeta, unregisterWindowMeta } from './main.js'

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

  const browserOptions: BrowserWindowConstructorOptions = {
    width: options.width ?? 1200,
    height: options.height ?? 800,
    minWidth: options.minWidth ?? 800,
    minHeight: options.minHeight ?? 600,
    title: options.title ?? 'Rivet',

    // ========== 无边框核心配置 ==========
    titleBarStyle: isMac ? 'hidden' : 'default',
    frame: isMac,
    ...(isMac ? { trafficLightPosition: { x: 16, y: 14 } } : {}),

    // 窗口行为
    show: options.show ?? false,
    resizable: options.resizable ?? true,
    alwaysOnTop: options.alwaysOnTop ?? false,
    parent: options.parent as BrowserWindow,
    modal: options.modal ?? false,

    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  }

  const win = new BrowserWindow(browserOptions)

  // ========== 窗口状态事件转发（带窗口ID）==========
  win.on('maximize', () => {
    if (!win.isDestroyed()) {
      win.webContents.send('window-state-changed', {
        windowId: options.id,
        isMaximized: true,
      })
    }
  })

  win.on('unmaximize', () => {
    if (!win.isDestroyed()) {
      win.webContents.send('window-state-changed', {
        windowId: options.id,
        isMaximized: false,
      })
    }
  })

  // ========== 加载页面 ==========
  const route = options.route ?? '/'

  if (!app.isPackaged) {
    void win.loadURL(`http://localhost:5173${route ? `#${route}` : ''}`)
  } else {
    void win.loadFile(path.join(__dirname, '../../renderer/index.html'), {
      hash: route,
    })
  }

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
  broadcast(channel: string, ...args: unknown[]): void {
    windowMap.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...(args as Parameters<typeof win.webContents.send>))
      }
    })
  },
} as const
