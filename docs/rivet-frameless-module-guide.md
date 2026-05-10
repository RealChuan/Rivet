# Rivet 模块化无边框窗口架构指南

> **适用项目**: RealChuan/Rivet  
> **技术栈**: Electron 42 + React 19 + Vite 8 + Tailwind CSS 4 + TypeScript 6  
> **目标**: 将无边框窗口抽象为可复用模块，支持主窗口及任意独立子窗口共享同一套无边框逻辑  
> **文档类型**: AI-IDE 编码开发手册（含完整文件路径、可直接复制粘贴的代码、操作指令）

---

## 1. 架构总览

### 1.1 核心设计

```
┌──────────────────────────────────────────────────────────────┐
│                      主进程 (Main Process)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              WindowFactory.create(options)            │   │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────────┐  │   │
│  │  │ MainWindow │ │SettingsWin │ │  PreviewWindow   │  │   │
│  │  │  route: /  │ │ route: /s  │ │   route: /prev   │  │   │
│  │  │  id: main  │ │  id: set   │ │    id: preview   │  │   │
│  │  └────────────┘ └────────────┘ └──────────────────┘  │   │
│  │         ↑ 统一注入 frameless 配置 + 通用 Preload      │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                                │
┌──────────────────────────────────────────────────────────────┐
│                    渲染进程 (Renderer Process)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              <TitleBar /> 通用组件                     │   │
│  │         (自动识别平台 / 支持 childMode)                │   │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────────┐  │   │
│  │  │ Main Page  │ │SettingsPage│ │  Preview Page    │  │   │
│  │  │+ TitleBar  │ │+ TitleBar  │ │  + TitleBar      │  │   │
│  │  └────────────┘ └────────────┘ └──────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 改造文件清单

| # | 文件路径 | 操作 | 说明 |
|---|---------|------|------|
| 1 | `src/main/window-factory.ts` | **新增** | 无边框窗口工厂 + WindowManager |
| 2 | `src/main/main.ts` | **重写** | 应用入口，注册全局 IPC，使用工厂创建窗口 |
| 3 | `src/main/preload/index.ts` | **重写** | 通用 Preload，暴露 windowControl + windowMeta + createChild |
| 4 | `src/types/electron.d.ts` | **新增/重写** | 全局 TypeScript 类型声明 |
| 5 | `src/renderer/index.css` | **修改** | 添加 `.draggable` / `.no-drag` Tailwind 工具类 |
| 6 | `src/renderer/components/TitleBar.tsx` | **新增** | 跨平台通用标题栏组件（支持 childMode） |
| 7 | `src/renderer/App.tsx` | **重写** | HashRouter 集成 + 根布局 + TitleBar |
| 8 | `src/renderer/pages/SettingsPage.tsx` | **新增（示例）** | 子窗口页面示例 |

---

## 2. 主进程：窗口工厂模块

### 2.1 文件：`src/main/window-factory.ts`（新增）

**操作指令**：在 `src/main/` 目录下新建此文件。

```typescript
/**
 * WindowFactory — 无边框窗口工厂
 * 
 * 所有 Rivet 窗口（主窗口、子窗口、对话框）的统一创建入口。
 * 自动应用平台适配的无边框配置，复用同一套 Preload 脚本。
 */

import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const isDev = process.env.NODE_ENV === 'development' || !BrowserWindow.getAllWindows()[0]?.webContents.isDevToolsOpened()

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
    width: options.width ?? 900,
    height: options.height ?? 600,
    minWidth: options.minWidth ?? 400,
    minHeight: options.minHeight ?? 300,
    title: options.title ?? 'Rivet',

    // ===== 无边框核心配置 =====
    titleBarStyle: isMac ? 'hidden' : 'default',
    frame: isMac,
    trafficLightPosition: isMac ? { x: 16, y: 14 } : undefined,

    // 窗口行为
    show: options.show ?? false,
    resizable: options.resizable ?? true,
    alwaysOnTop: options.alwaysOnTop ?? false,
    parent: options.parent,
    modal: options.modal ?? false,

    webPreferences: {
      preload: path.join(__dirname, 'preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // 通过命令行参数传递窗口元数据到渲染进程
      additionalArguments: [
        `--window-id=${options.id}`,
        `--route=${options.route ?? '/'}`,
      ],
    },
  }

  const win = new BrowserWindow(browserOptions)

  // ===== 窗口状态事件转发（带窗口ID） =====
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

  // ===== 加载页面 =====
  const route = options.route ?? '/'

  if (isDev) {
    win.loadURL(`http://localhost:5173${route}`)
    // 开发环境自动打开 DevTools（可选）
    // win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../../renderer/index.html'), {
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
    // 防止重复创建：若已存在则聚焦
    const existing = windowMap.get(options.id)
    if (existing && !existing.isDestroyed()) {
      existing.focus()
      return existing
    }

    const win = createFramelessWindow(options)
    windowMap.set(options.id, win)

    win.on('closed', () => {
      windowMap.delete(options.id)
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
    return Array.from(windowMap.values()).filter((w) => !w.isDestroyed())
  },

  /**
   * 向所有存活窗口广播 IPC 消息
   */
  broadcast(channel: string, ...args: any[]): void {
    windowMap.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args)
      }
    })
  },
} as const
```

---

## 3. 主进程入口

### 3.1 文件：`src/main/main.ts`（重写）

**操作指令**：完全替换现有 `src/main/main.ts` 内容。

```typescript
/**
 * Rivet 主进程入口
 * 
 * 职责：
 * 1. 注册全局 IPC 处理器（窗口控制、子窗口管理）
 * 2. 初始化应用配置、日志、业务 IPC
 * 3. 使用 WindowManager 创建主窗口
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import { WindowManager } from './window-factory.js'
import logger from './logger.js'
import { setupIpcHandlers } from './ipc-handlers/index.js'
import { loadConfig, saveConfig } from './store.js'

// ============================================================
// IPC：窗口控制（所有窗口复用同一套处理器）
// ============================================================

ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.close()
})

ipcMain.handle('window-get-state', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return {
    isMaximized: win?.isMaximized() ?? false,
    platform: process.platform,
  }
})

// ============================================================
// IPC：子窗口管理
// ============================================================

ipcMain.handle('window-create', (_event, options: {
  id: string
  route: string
  width?: number
  height?: number
  title?: string
}) => {
  const win = WindowManager.create({
    ...options,
    width: options.width ?? 800,
    height: options.height ?? 600,
  })
  return options.id
})

ipcMain.handle('window-close-by-id', (_event, id: string) => {
  WindowManager.close(id)
  return true
})

// ============================================================
// 应用生命周期
// ============================================================

app.whenReady().then(() => {
  logger.info('App ready, initializing...')

  loadConfig()
  setupIpcHandlers()

  // 创建主窗口
  WindowManager.create({
    id: 'main',
    route: '/',
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Rivet',
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      WindowManager.create({
        id: 'main',
        route: '/',
        title: 'Rivet',
      })
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  logger.info('App quitting')
  saveConfig()
})

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error}`)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`)
})
```

---

## 4. Preload 脚本

### 4.1 文件：`src/main/preload/index.ts`（重写）

**操作指令**：完全替换现有 Preload 文件内容。若你的 Preload 分散在多文件中，请将 `windowControl` 和 `windowMeta` 合并到最终暴露给渲染进程的对象中。

```typescript
/**
 * Rivet Preload 脚本
 * 
 * 安全原则：
 * - 仅通过 contextBridge 暴露白名单 API
 * - 禁止直接暴露 ipcRenderer 对象
 * - 所有通信使用 send/invoke/on 的包装器
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// ============================================================
// 窗口控制 API
// ============================================================

const windowControl = {
  minimize: (): void => {
    ipcRenderer.send('window-minimize')
  },

  maximize: (): void => {
    ipcRenderer.send('window-maximize')
  },

  close: (): void => {
    ipcRenderer.send('window-close')
  },

  getState: (): Promise<{ isMaximized: boolean; platform: string }> => {
    return ipcRenderer.invoke('window-get-state')
  },

  onStateChange: (
    callback: (state: { isMaximized: boolean }) => void
  ): (() => void) => {
    const handler = (_: IpcRendererEvent, state: { isMaximized: boolean }) => {
      callback(state)
    }
    ipcRenderer.on('window-state-changed', handler)
    return () => {
      ipcRenderer.removeListener('window-state-changed', handler)
    }
  },

  // ===== 子窗口管理 =====
  createChild: (options: {
    id: string
    route: string
    width?: number
    height?: number
    title?: string
  }): Promise<string> => {
    return ipcRenderer.invoke('window-create', options)
  },

  closeChild: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke('window-close-by-id', id)
  },
} as const

// ============================================================
// 窗口元数据（从 additionalArguments 解析）
// ============================================================

function getWindowMeta() {
  const args = process.argv
  const idArg = args.find((a) => a.startsWith('--window-id='))
  const routeArg = args.find((a) => a.startsWith('--route='))
  return {
    windowId: idArg?.replace('--window-id=', '') ?? 'unknown',
    route: routeArg?.replace('--route=', '') ?? '/',
  }
}

// ============================================================
// 暴露到全局
// ============================================================

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  windowControl,
  // 窗口元数据
  windowMeta: getWindowMeta(),

  // TODO: 在此追加你现有的其他 API
  // 例如：
  // store: { ... },
  // sftp: { ... },
  // webdav: { ... },
})
```

---

## 5. TypeScript 全局类型声明

### 5.1 文件：`src/types/electron.d.ts`（新增）

**操作指令**：若 `src/types/` 目录不存在则新建，然后创建此文件。

```typescript
/**
 * Electron Preload API 全局类型声明
 * 
 * 使 TypeScript 在渲染进程中识别 window.electronAPI
 * 此文件应被 tsconfig.json 的 include 包含
 */

// ============================================================
// 窗口控制
// ============================================================

export interface WindowState {
  isMaximized: boolean
  platform: string
}

export interface WindowControlAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  getState: () => Promise<WindowState>
  onStateChange: (callback: (state: { isMaximized: boolean }) => void) => () => void

  // 子窗口管理
  createChild: (options: {
    id: string
    route: string
    width?: number
    height?: number
    title?: string
  }) => Promise<string>
  closeChild: (id: string) => Promise<boolean>
}

// ============================================================
// 窗口元数据
// ============================================================

export interface WindowMeta {
  windowId: string
  route: string
}

// ============================================================
// 全局 API
// ============================================================

export interface IElectronAPI {
  windowControl: WindowControlAPI
  windowMeta: WindowMeta

  // TODO: 在此追加你现有的其他 API 类型
  // store: { get: (key: string) => any; set: (key: string, val: any) => void }
  // sftp: { connect: (config: any) => Promise<any> }
  // ...
}

// ============================================================
// 全局声明
// ============================================================

declare global {
  interface Window {
    readonly electronAPI: IElectronAPI
  }
}

export {}
```

---

## 6. Tailwind 工具类

### 6.1 文件：`src/renderer/index.css`（修改）

**操作指令**：在现有 `@tailwind` 指令下方追加 `@layer utilities`。

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/**
 * ============================================================
 * Electron 无边框窗口拖拽工具类
 * ============================================================
 */

@layer utilities {
  /**
   * 使元素成为窗口拖拽区域
   * 应用此类的元素可拖动整个窗口位置
   */
  .draggable {
    -webkit-app-region: drag;
    app-region: drag;
  }

  /**
   * 在拖拽区域内排除特定元素
   * 应用此类的元素可正常接收鼠标事件（点击、hover）
   */
  .no-drag {
    -webkit-app-region: no-drag;
    app-region: no-drag;
  }

  /**
   * 标题栏文字防选中
   */
  .titlebar-text {
    user-select: none;
    -webkit-user-select: none;
  }
}
```

---

## 7. 通用标题栏组件

### 7.1 文件：`src/renderer/components/TitleBar.tsx`（新增）

**操作指令**：在 `src/renderer/components/` 目录下新建此文件。

```tsx
/**
 * TitleBar — 跨平台无边框窗口标题栏
 * 
 * 特性：
 * - 自动识别平台（macOS / Windows / Linux）
 * - macOS：仅显示占位条，系统交通灯自动渲染
 * - Windows/Linux：完整自定义按钮（最小化/最大化/关闭）
 * - 支持 childMode：子窗口隐藏最大化按钮，仅显示关闭
 * - 支持自定义中间内容和左侧内容
 */

import { useState, useEffect, useCallback } from 'react'

// ============================================================
// 内联 SVG 图标（零外部依赖）
// 若项目已安装 lucide-react，可替换为 import { Minus, Square, X, Maximize2 } from 'lucide-react'
// ============================================================

const IconMinus = ({ className }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const IconSquare = ({ className }: { className?: string }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
)

const IconMaximize2 = ({ className }: { className?: string }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
)

const IconX = ({ className }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// ============================================================
// Props 定义
// ============================================================

export interface TitleBarProps {
  /**
   * 子窗口模式
   * - true: 隐藏最小化/最大化，仅显示关闭按钮
   * - false: 显示完整窗口控制按钮
   */
  childMode?: boolean
  /**
   * 标题栏中间区域自定义内容
   * 例如：标签页、面包屑、搜索框
   */
  centerContent?: React.ReactNode
  /**
   * 标题栏左侧额外内容（在 Logo/标题之后）
   */
  leftContent?: React.ReactNode
  /**
   * 自定义标题文字（默认 'Rivet'）
   */
  title?: string
}

// ============================================================
// 组件实现
// ============================================================

export function TitleBar({
  childMode = false,
  centerContent,
  leftContent,
  title = 'Rivet',
}: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [platform, setPlatform] = useState<string>('win32')

  // 初始化窗口状态 + 订阅变化
  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const init = async () => {
      try {
        const state = await window.electronAPI.windowControl.getState()
        setIsMaximized(state.isMaximized)
        setPlatform(state.platform)

        unsubscribe = window.electronAPI.windowControl.onStateChange((newState) => {
          setIsMaximized(newState.isMaximized)
        })
      } catch (err) {
        console.error('[TitleBar] Failed to initialize window state:', err)
      }
    }

    init()
    return () => unsubscribe?.()
  }, [])

  const handleMinimize = useCallback(() => {
    window.electronAPI.windowControl.minimize()
  }, [])

  const handleMaximize = useCallback(() => {
    window.electronAPI.windowControl.maximize()
  }, [])

  const handleClose = useCallback(() => {
    window.electronAPI.windowControl.close()
  }, [])

  const isMac = platform === 'darwin'

  // ==================== macOS 标题栏 ====================
  if (isMac) {
    return (
      <header
        className="h-9 bg-neutral-900 border-b border-neutral-800 flex items-center justify-center draggable titlebar-text shrink-0"
        data-testid="titlebar-macos"
      >
        {/*
          macOS 系统会自动在左上角渲染交通灯按钮（红黄绿）。
          此区域只需留出足够高度（h-9），居中显示应用名称即可。
          如需在左侧放置自定义内容，请确保留出至少 80px 的左内边距。
        */}
        <span className="text-xs text-neutral-400 font-medium tracking-wide">
          {title}
        </span>
      </header>
    )
  }

  // ==================== Windows / Linux 标题栏 ====================
  return (
    <header
      className="h-9 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between shrink-0"
      data-testid="titlebar-win32"
    >
      {/* 左侧：拖拽区 + 应用标识 */}
      <div
        className="flex-1 flex items-center h-full px-3 draggable titlebar-text"
        onDoubleClick={childMode ? undefined : handleMaximize}
        role="button"
        aria-label="Drag to move window. Double-click to maximize."
      >
        <div className="flex items-center gap-2 no-drag">
          {/* 应用 Logo */}
          <div
            className="w-4 h-4 rounded bg-blue-500 shadow-sm"
            aria-hidden="true"
          />
          <span className="text-xs text-neutral-300 font-medium">
            {title}
          </span>
          {leftContent}
        </div>
      </div>

      {/* 中间：可扩展区域 */}
      {centerContent && (
        <div className="no-drag flex-1 flex items-center justify-center">
          {centerContent}
        </div>
      )}

      {/* 右侧：窗口控制按钮 */}
      <div className="flex h-full no-drag">
        {!childMode && (
          <>
            <button
              onClick={handleMinimize}
              className="w-10 h-full flex items-center justify-center text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors duration-150 focus:outline-none"
              aria-label="Minimize"
              type="button"
            >
              <IconMinus />
            </button>

            <button
              onClick={handleMaximize}
              className="w-10 h-full flex items-center justify-center text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors duration-150 focus:outline-none"
              aria-label={isMaximized ? 'Restore' : 'Maximize'}
              type="button"
            >
              {isMaximized ? <IconMaximize2 /> : <IconSquare />}
            </button>
          </>
        )}

        <button
          onClick={handleClose}
          className="w-10 h-full flex items-center justify-center text-neutral-400 hover:bg-red-600 hover:text-white transition-colors duration-150 focus:outline-none"
          aria-label="Close"
          type="button"
        >
          <IconX />
        </button>
      </div>
    </header>
  )
}

export default TitleBar
```

---

## 8. 根布局与路由

### 8.1 前置依赖

**操作指令**：确保已安装 `react-router-dom`：

```bash
npm install react-router-dom
```

### 8.2 文件：`src/renderer/App.tsx`（重写）

**操作指令**：完全替换现有 `App.tsx` 内容。

```tsx
/**
 * Rivet 渲染进程根组件
 * 
 * 使用 HashRouter 配合 Electron loadFile({ hash }) 实现多窗口路由。
 * 每个窗口（主窗口、子窗口）共享同一套 HTML 入口，通过 hash 区分页面。
 */

import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { TitleBar } from './components/TitleBar'

// TODO: 导入你的现有页面组件
// import { MainPage } from './pages/MainPage'
// import { SettingsPage } from './pages/SettingsPage'

// ============================================================
// 布局包装器（自动根据路由判断 childMode）
// ============================================================

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isMainWindow = location.pathname === '/' || location.pathname === ''

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 text-white overflow-hidden">
      <TitleBar
        childMode={!isMainWindow}
        title={isMainWindow ? 'Rivet' : `Rivet — ${location.pathname}`}
      />
      <main className="flex-1 overflow-auto relative">
        {children}
      </main>
    </div>
  )
}

// ============================================================
// 页面占位组件（开发时临时使用，应替换为你的真实页面）
// ============================================================

function MainPage() {
  const openSettings = async () => {
    await window.electronAPI.windowControl.createChild({
      id: 'settings',
      route: '/settings',
      width: 700,
      height: 500,
      title: 'Settings — Rivet',
    })
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Rivet Main Window</h1>
      <p className="text-neutral-400 mb-6">This is the main application window.</p>
      <button
        onClick={openSettings}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-medium transition-colors"
      >
        Open Settings Window
      </button>
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Settings</h1>
      <p className="text-neutral-400">This is a child window running in a separate BrowserWindow.</p>
    </div>
  )
}

// ============================================================
// 根组件
// ============================================================

function App() {
  return (
    <HashRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* TODO: 在此追加更多路由 */}
        </Routes>
      </AppLayout>
    </HashRouter>
  )
}

export default App
```

---

## 9. 子窗口页面示例

### 9.1 文件：`src/renderer/pages/SettingsPage.tsx`（新增）

**操作指令**：若你已将 `SettingsPage` 内联在 `App.tsx` 中，可跳过此步骤。否则，建议将页面组件独立到 `pages/` 目录。

```tsx
/**
 * SettingsPage — 子窗口示例页面
 * 
 * 此页面通过 HashRouter 的 '/settings' 路由加载，
 * 运行在独立的 BrowserWindow 中（id: 'settings'）。
 */

export function SettingsPage() {
  return (
    <div className="h-full p-6">
      <h1 className="text-xl font-bold text-white mb-2">Settings</h1>
      <p className="text-sm text-neutral-400 mb-6">
        Configure your Rivet preferences.
      </p>

      <div className="space-y-4 max-w-md">
        <div className="flex items-center justify-between py-3 border-b border-neutral-800">
          <span className="text-sm text-neutral-300">Dark Mode</span>
          <div className="w-10 h-5 bg-blue-600 rounded-full relative">
            <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full" />
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-neutral-800">
          <span className="text-sm text-neutral-300">Auto Update</span>
          <div className="w-10 h-5 bg-neutral-700 rounded-full relative">
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-neutral-400 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## 10. 平台差异速查表

| 特性 | macOS | Windows | Linux |
|------|-------|---------|-------|
| 主进程配置 | `frame: true` + `titleBarStyle: 'hidden'` | `frame: false` | `frame: false` |
| 系统交通灯 | ✅ 自动渲染 | ❌ 无 | ❌ 无 |
| 自定义按钮 | 不需要 | React 实现 | React 实现 |
| 窗口拖拽 | `.draggable` 类 | `.draggable` 类 | `.draggable` 类 |
| 双击最大化 | 系统默认支持 | 需手动绑定 `onDoubleClick` | 需手动绑定 `onDoubleClick` |
| 右键菜单 | 系统默认 | 需自行实现（可选） | 需自行实现（可选） |
| Win11 Snap Layout | — | `frame: false` 时不支持原生 Snap | — |

---

## 11. FAQ / 常见问题

### Q1: 如何新增一个子窗口（例如 "About" 窗口）？

**步骤**：
1. 在 `App.tsx` 的 `<Routes>` 中新增 `<Route path="/about" element={<AboutPage />} />`
2. 在任意页面中调用：
   ```typescript
   await window.electronAPI.windowControl.createChild({
     id: 'about',
     route: '/about',
     width: 500,
     height: 400,
     title: 'About — Rivet',
   })
   ```
3. 无需修改主进程代码，WindowManager 会自动处理。

### Q2: 子窗口的 `id` 重复会怎样？

WindowManager 会检测到已存在的窗口并执行 `focus()`，不会重复创建。若需要强制新建，先调用 `window.electronAPI.windowControl.closeChild('id')` 关闭旧窗口。

### Q3: 如何创建模态对话框？

在 `createChild` 的参数中增加 `modal: true`，并传入 `parent` 窗口引用（需通过 IPC 传递 parent 的 webContents ID，较复杂）。更简单的方式：在 `window-factory.ts` 中直接扩展 `WindowManager.createModal(parentId, options)` 方法。

### Q4: 开发时 Vite HMR 导致 `window.electronAPI` 丢失？

Electron 的 Preload 只在窗口加载时注入一次。React Fast Refresh 不会重新注入 Preload。若遇到此问题，**刷新整个窗口**（Ctrl+R / Cmd+R）即可恢复。

### Q5: macOS 全屏后标题栏消失？

在 `window-factory.ts` 中监听全屏事件并通知渲染进程：

```typescript
win.on('enter-full-screen', () => {
  win.webContents.send('window-fullscreen-changed', true)
})
win.on('leave-full-screen', () => {
  win.webContents.send('window-fullscreen-changed', false)
})
```

然后在 `TitleBar.tsx` 中接收此事件并隐藏自身（`display: none` 或条件渲染）。

### Q6: 标题栏按钮点击无反应？

**排查清单**：
1. 按钮元素是否有 `no-drag` class？（无此 class 时点击会被 `-webkit-app-region: drag` 拦截）
2. Preload 是否正确暴露 `windowControl`？
3. 主进程 IPC 处理器是否已注册？（检查 `main.ts` 中的 `ipcMain.on`）
4. `contextIsolation` 是否为 `true`？（若为 `false`，`contextBridge` 不会生效）

---

## 12. 验证检查清单

在提交代码前，逐项确认：

### 文件结构
- [ ] `src/main/window-factory.ts` 已创建
- [ ] `src/main/main.ts` 已重写
- [ ] `src/main/preload/index.ts` 已重写
- [ ] `src/types/electron.d.ts` 已创建
- [ ] `src/renderer/index.css` 已添加 utilities
- [ ] `src/renderer/components/TitleBar.tsx` 已创建
- [ ] `src/renderer/App.tsx` 已重写
- [ ] `react-router-dom` 已安装

### 功能验证
- [ ] **主窗口**：无边框，可拖拽，按钮工作，可最大化/最小化/关闭
- [ ] **macOS**：交通灯按钮可见，位置正确（`trafficLightPosition`）
- [ ] **Windows**：无边框，自定义按钮样式正确，hover 效果正常
- [ ] **Linux**：无边框，按钮工作
- [ ] **子窗口**：可通过 `createChild` 打开，显示独立窗口，关闭按钮工作
- [ ] **子窗口重复打开**：同一 `id` 不会重复创建，而是聚焦已有窗口
- [ ] **TypeScript**：渲染进程中 `window.electronAPI` 无类型错误
- [ ] **双击最大化**：Windows/Linux 标题栏左侧双击可最大化/还原

---

## 13. 扩展建议

### 13.1 在标题栏中添加标签页（Tabs）

```tsx
<TitleBar
  centerContent={
    <div className="flex items-center gap-1">
      <button className="px-3 py-1 text-xs bg-neutral-800 rounded text-white">Local</button>
      <button className="px-3 py-1 text-xs hover:bg-neutral-800 rounded text-neutral-400">SFTP</button>
    </div>
  }
/>
```

### 13.2 动态主题适配

通过 Zustand store 读取主题状态，动态切换标题栏背景：

```tsx
import { useThemeStore } from '@/store/theme'

const { isDark } = useThemeStore()
const bgClass = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'
const textClass = isDark ? 'text-neutral-300' : 'text-neutral-700'
```

### 13.3 可访问性增强

- 已内置 `aria-label` 和 `role="button"`
- 可添加键盘快捷键（如 `Alt+F4` 关闭、`F11` 全屏）
- 支持 Windows 高对比度模式（通过 `prefers-contrast` 媒体查询）

---

*文档版本: 2.0*  
*最后更新: 2026-05-10*  
*适用 Electron 版本: ^42.0.1*  
*适用 React Router 版本: ^6.x*
