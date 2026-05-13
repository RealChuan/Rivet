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
import { logger } from '../utils/index.js'
import { setupIpcHandlers } from '../ipc/index.js'
import { loadConfig, saveConfig } from '../stores/index.js'
import { MAIN_WINDOW_ID } from '@shared/constants/index.js'
import { sessionManager, ProtocolFactory } from '../services/protocol/index.js'

// ============================================================
// 窗口元数据管理（解决 sandbox 模式下 process.argv 不可用问题）
// ============================================================
const windowMetaMap = new Map<number, { windowId: string; route: string }>()

export function registerWindowMeta(win: BrowserWindow, id: string, route: string): void {
  windowMetaMap.set(win.id, { windowId: id, route })
  win.on('closed', () => windowMetaMap.delete(win.id))
}

ipcMain.handle('get-window-meta', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { windowId: 'unknown', route: '/' }
  return windowMetaMap.get(win.id) ?? { windowId: 'unknown', route: '/' }
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

let isCleaningUp = false

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout])
}

async function disconnectAllSessions(): Promise<void> {
  if (isCleaningUp || sessionManager.count === 0) return

  isCleaningUp = true
  logger.info(`Disconnecting ${sessionManager.count} active sessions...`)

  try {
    const sftpSessions = sessionManager.getByProtocol('sftp')
    const webdavSessions = sessionManager.getByProtocol('webdav')

    // 并发发起所有 disconnect，每个独立带 5 秒超时
    const disconnectPromises = [
      ...sftpSessions.map(({ sessionId }) =>
        withTimeout(
          ProtocolFactory.getProtocol('sftp').disconnect(sessionId),
          5000,
          `SFTP disconnect ${sessionId}`
        ).catch((err: unknown) => {
          logger.error(`Failed to disconnect SFTP session ${sessionId}:`, err)
        })
      ),
      ...webdavSessions.map(({ sessionId }) =>
        withTimeout(
          ProtocolFactory.getProtocol('webdav').disconnect(sessionId),
          5000,
          `WebDAV disconnect ${sessionId}`
        ).catch((err: unknown) => {
          logger.error(`Failed to disconnect WebDAV session ${sessionId}:`, err)
        })
      ),
    ]

    // 等待所有 disconnect 完成（或超时）
    const results = await Promise.allSettled(disconnectPromises)

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    logger.info(`Disconnect complete: ${succeeded} succeeded, ${failed} failed`)

    sessionManager.clear()
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    logger.error(`Error during disconnectAllSessions: ${errMsg}`)
  } finally {
    isCleaningUp = false
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
    }, 10000)

    try {
      await disconnectAllSessions()
      saveConfig()
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
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
  const reasonStr = reason instanceof Error ? reason.message : String(reason)
  logger.error(`Unhandled rejection: ${reasonStr}`)
})

process.on('SIGTERM', () => {
  logger.info('SIGTERM received')
  void (async () => {
    try {
      await disconnectAllSessions()
      saveConfig()
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
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
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Error during SIGINT cleanup: ${errMsg}`)
    } finally {
      app.quit()
    }
  })()
})
