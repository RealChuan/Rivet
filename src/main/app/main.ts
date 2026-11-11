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
import { initializeI18n } from '../i18n/index.js'
import { setupIpcHandlers } from '../ipc/index.js'
import { applyPersistedConcurrency, applyPersistedSpeedLimits } from '../services/transfer/index.js'
import { getUiSettings, initializeStores } from '../stores/index.js'
import { logger } from '../utils/index.js'
import {
  createMainWindow,
  requestQuitFromTray,
  setupAppLifecycle,
  setupTray,
  showMainWindow,
} from './index.js'
import { initSentry } from './sentry.js'

app.setName(APP_NAME)
app.enableSandbox()

/** 配置是整份 JSON 原子写，两个进程会互相覆盖；第二次启动只唤起已有窗口。 */
function acquireSingleInstanceLock(): boolean {
  if (app.requestSingleInstanceLock()) return true

  logger.info('Another instance is already running, focusing it and exiting')
  app.exit(0)
  return false
}

function bootstrap(): void {
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
  initializeI18n(getUiSettings().locale)
  applyPersistedConcurrency()
  applyPersistedSpeedLimits()
  setupIpcHandlers()
  createMainWindow()
  setupTray({ onShow: showMainWindow, onQuit: requestQuitFromTray })
}

function start(): void {
  if (!acquireSingleInstanceLock()) return

  app.on('second-instance', () => {
    showMainWindow()
  })

  initSentry()
  void app.whenReady().then(bootstrap)
  setupAppLifecycle()
}

start()
