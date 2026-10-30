/**
 * Rivet 主进程入口
 *
 * 职责：
 * 1. 注册全局 IPC 处理器
 * 2. 初始化应用配置、日志、业务 IPC
 * 3. 创建唯一主窗口
 */

import { app, session } from 'electron'

import { APP_NAME } from '@shared/constants/index.js'
import { setupIpcHandlers } from '../ipc/index.js'
import { applyPersistedConcurrency } from '../services/transfer/index.js'
import { initializeStores } from '../stores/index.js'
import { logger } from '../utils/index.js'
import { createMainWindow, setupAppLifecycle } from './index.js'
import { initSentry } from './sentry.js'

initSentry()

app.setName(APP_NAME)
app.enableSandbox()

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
  const styleSrc = isDev ? "'self' 'unsafe-inline'" : "'self'"
  const csp = `default-src 'self'; script-src ${scriptSrc}; style-src ${styleSrc}; img-src 'self' data:; font-src 'self'; connect-src ${connectSrc}; object-src 'none'; base-uri 'self'; form-action 'none'`

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })

  initializeStores()
  applyPersistedConcurrency()
  setupIpcHandlers()
  createMainWindow()
})

setupAppLifecycle()
