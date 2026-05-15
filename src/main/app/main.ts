/**
 * Rivet 主进程入口
 *
 * 职责：
 * 1. 注册全局 IPC 处理器（窗口控制、子窗口管理）
 * 2. 初始化应用配置、日志、业务 IPC
 * 3. 使用 WindowManager 创建主窗口
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import { Mutex } from 'async-mutex'
import { WindowManager } from './window-factory.js'
import { logger } from '../utils/index.js'
import { setupIpcHandlers } from '../ipc/index.js'
import { loadConfig, saveConfig } from '../stores/index.js'
import { MAIN_WINDOW_ID } from '@shared/constants/index.js'
import { TIMEOUTS } from '@shared/constants/timeouts.js'
import { toErrorMessage } from '@shared/utils/index.js'
import { sessionManager } from '../services/index.js'

// ============================================================
// 窗口元数据管理（解决 sandbox 模式下 process.argv 不可用问题）
// 使用 WeakMap 避免 BrowserWindow.id 重用导致的竞态问题
// ============================================================
const windowMetaMap = new WeakMap<BrowserWindow, { windowId: string; route: string }>()

export function registerWindowMeta(win: BrowserWindow, id: string, route: string): void {
  windowMetaMap.set(win, { windowId: id, route })
}

export function unregisterWindowMeta(win: BrowserWindow): void {
  windowMetaMap.delete(win)
}

ipcMain.handle('get-window-meta', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { windowId: 'unknown', route: '/' }
  return windowMetaMap.get(win) ?? { windowId: 'unknown', route: '/' }
})

// ============================================================
// IPC：窗口控制（所有窗口复用同一套处理器）
// ============================================================

ipcMain.on('window-minimize', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})

ipcMain.on('window-maximize', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

ipcMain.on('window-close', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.close()
})

ipcMain.handle('window-get-state', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return {
    isMaximized: win?.isMaximized() ?? false,
    platform: process.platform,
  }
})

// ============================================================
// IPC：子窗口管理
// ============================================================

ipcMain.handle(
  'window-create',
  (
    _event,
    options: {
      id: string
      route: string
      width?: number
      height?: number
      title?: string
    }
  ) => {
    WindowManager.create({
      ...options,
      width: options.width ?? 800,
      height: options.height ?? 600,
    })
    return options.id
  }
)

ipcMain.handle('window-close-by-id', (_event, id: string) => {
  WindowManager.close(id)
  return true
})

const cleanupMutex = new Mutex()
let isCleaningUp = false

async function disconnectAllSessions(): Promise<void> {
  const release = await cleanupMutex.acquire()
  try {
    if (isCleaningUp || sessionManager.count === 0) return
    isCleaningUp = true
    logger.info(`Disconnecting ${sessionManager.count} active sessions...`)
    await sessionManager.safeUnregisterAll()
  } catch (error: unknown) {
    const errMsg = toErrorMessage(error)
    logger.error(`Error during disconnectAllSessions: ${errMsg}`)
  } finally {
    isCleaningUp = false
    release()
  }
}

// ============================================================
// 应用生命周期
// ============================================================

void app.whenReady().then(() => {
  logger.info('App ready, initializing...')

  void loadConfig()
  setupIpcHandlers()

  // 创建主窗口
  void WindowManager.create({
    id: MAIN_WINDOW_ID,
    route: '/',
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    title: 'Rivet',
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void WindowManager.create({
        id: MAIN_WINDOW_ID,
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

app.on('before-quit', event => {
  if (isCleaningUp) return

  event.preventDefault()
  logger.info('App quitting, cleaning up sessions...')

  void (async () => {
    // 总超时 10 秒，无论 cleanup 是否完成都强制退出
    const forceExitTimeout = setTimeout(() => {
      logger.warn('Force exiting after timeout - some sessions may not have disconnected properly')
      app.exit(0)
    }, TIMEOUTS.FORCE_EXIT)

    try {
      await disconnectAllSessions()
      saveConfig()
    } catch (error: unknown) {
      const errMsg = toErrorMessage(error)
      logger.error(`Error during quit cleanup: ${errMsg}`)
    } finally {
      clearTimeout(forceExitTimeout)
      app.exit(0)
    }
  })()
})

process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught exception: ${error.message || 'Unknown error'}`)
  void (async () => {
    try {
      await disconnectAllSessions()
    } catch (cleanupError: unknown) {
      const errMsg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
      logger.error(`Failed to cleanup during uncaughtException: ${errMsg}`)
    } finally {
      process.exit(1)
    }
  })()
})

process.on('unhandledRejection', (reason: unknown) => {
  const reasonStr = toErrorMessage(reason)
  logger.error(`Unhandled rejection: ${reasonStr}`)
})

process.on('SIGTERM', () => {
  logger.info('SIGTERM received')
  void (async () => {
    try {
      await disconnectAllSessions()
      saveConfig()
    } catch (error: unknown) {
      const errMsg = toErrorMessage(error)
      logger.error(`Error during SIGTERM cleanup: ${errMsg}`)
    } finally {
      app.quit()
    }
  })()
})

process.on('SIGINT', () => {
  logger.info('SIGINT received')
  void (async () => {
    try {
      await disconnectAllSessions()
      saveConfig()
    } catch (error: unknown) {
      const errMsg = toErrorMessage(error)
      logger.error(`Error during SIGINT cleanup: ${errMsg}`)
    } finally {
      app.quit()
    }
  })()
})
