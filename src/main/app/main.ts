/**
 * Rivet 主进程入口
 *
 * 职责：
 * 1. 注册全局 IPC 处理器（窗口控制、子窗口管理）
 * 2. 初始化应用配置、日志、业务 IPC
 * 3. 使用 WindowManager 创建主窗口
 */

import { app, session } from 'electron'
import * as Sentry from '@sentry/electron/main'
import { logger } from '../utils/index.js'
import { setupIpcHandlers } from '../ipc/index.js'
import { initializeConfig, startAutoSave } from '../stores/index.js'
import { setupAppLifecycle, createMainWindow } from './index.js'

// 初始化 Sentry 崩溃报告（仅生产环境且配置了 DSN 时启用）
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? '',
  environment: app.isPackaged ? 'production' : 'development',
  enabled: app.isPackaged && !!process.env.SENTRY_DSN,
  sendDefaultPii: false,
})

void app.whenReady().then(() => {
  logger.info('App ready, initializing...')

  // 拒绝所有权限请求
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  // 通过 HTTP 头增强 CSP（开发环境放宽以支持 Vite HMR）
  const isDev = !app.isPackaged
  const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'"
  const connectSrc = isDev ? "'self' ws://localhost:*" : "'self'"
  const csp = `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src ${connectSrc}; object-src 'none'; base-uri 'self'; form-action 'none'`

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })

  initializeConfig()
  startAutoSave()
  setupIpcHandlers()
  createMainWindow()
})

setupAppLifecycle()
