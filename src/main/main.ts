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
import logger from './utils/logger.js'
import { setupIpcHandlers } from './ipc-handlers/index.js'
import { loadConfig, saveConfig } from './utils/store.js'

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

process.on('uncaughtException', error => {
  logger.error(`Uncaught exception: ${error}`)
  process.exit(1)
})

process.on('unhandledRejection', reason => {
  logger.error(`Unhandled rejection: ${reason}`)
})
