import { app } from 'electron'
import { CLOSE_BEHAVIOR, TIMEOUTS } from '@shared/constants/index.js'
import { EVENT_CHANNEL } from '@shared/contract/events.contract.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import { sessionManager, sessionRegistry, transferService } from '../services/index.js'
import { flushStores, getUiSettings } from '../stores/index.js'
import { logger } from '../utils/index.js'
import {
  forceQuit,
  isCloseConfirmed,
  isQuitting,
  markQuitting,
  requestClose,
  resetCloseGuard,
} from './close-guard.js'
import { getMainWindow, sendToMainWindow, setMainWindow } from './main-window.js'
import { destroyTray } from './tray.js'
import { createAppWindow } from './window-factory.js'
import { applyWindowTheme, attachSystemThemeListener } from './window-theme.js'

let isCleaningUp = false

export async function disconnectAllSessions(): Promise<void> {
  if (isCleaningUp || sessionRegistry.count === 0) return
  isCleaningUp = true

  try {
    logger.info(`Disconnecting ${sessionRegistry.count} active sessions...`)
    const result = await sessionManager.safeUnregisterAll()
    if (!result.success) {
      logger.catch(result.error, { action: 'disconnect-all-sessions' })
    } else if (!result.value) {
      logger.warn('Some sessions failed to disconnect')
    }
  } catch (error: unknown) {
    const errMsg = formatErrorMessage(error)
    logger.error(`Error during disconnectAllSessions: ${errMsg}`)
  } finally {
    isCleaningUp = false
  }
}

/**
 * 任务不落盘，退出就等于全部放弃，所以要把半成品一起清掉。
 * 这里不设超时：宁可多等几秒，也不要留下清不干净的临时文件；
 * 期间渲染层会盖一层「正在清理」的遮罩，用户不会以为卡死。
 */
async function cleanupTransferTemps(): Promise<void> {
  try {
    // 通知是尽力而为：发不出去也要继续清理，不能因为界面没响应就跳过。
    sendToMainWindow(EVENT_CHANNEL.CLEANUP_STARTED, {})
    await transferService.shutdown()
  } catch (error: unknown) {
    const errMsg = formatErrorMessage(error)
    logger.error(`Error during transfer temp cleanup: ${errMsg}`)
  }
}

export async function cleanupAndExit(
  signalName: string,
  shouldSaveConfig: boolean,
  exitCode: number,
): Promise<void> {
  logger.info(`${signalName} received, cleaning up...`)

  try {
    await disconnectAllSessions()
    await cleanupTransferTemps()
    if (shouldSaveConfig) {
      await flushStores()
    }
  } finally {
    destroyTray()
    if (exitCode === 0) {
      app.quit()
    } else {
      process.exit(exitCode)
    }
  }
}

export function setupAppLifecycle(): void {
  attachSystemThemeListener()

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', (event) => {
    if (isCleaningUp) return

    if (!isCloseConfirmed() && requestClose(getMainWindow(), 'quit')) {
      event.preventDefault()
      return
    }

    markQuitting()
    event.preventDefault()
    logger.info('App quitting, cleaning up sessions...')

    void (async () => {
      const forceExitTimeout = setTimeout(() => {
        logger.warn(
          'Force exiting after timeout - some sessions may not have disconnected properly',
        )
        app.exit(0)
      }, TIMEOUTS.FORCE_EXIT)

      try {
        await disconnectAllSessions()
        // 剩下的都是本地 IO：撤掉强制退出的兜底，否则可能把清理掐在半路。
        clearTimeout(forceExitTimeout)
        await cleanupTransferTemps()
        await flushStores()
      } catch (error: unknown) {
        const errMsg = formatErrorMessage(error)
        logger.error(`Error during quit cleanup: ${errMsg}`)
      } finally {
        clearTimeout(forceExitTimeout)
        destroyTray()
        app.exit(0)
      }
    })()
  })

  process.on('uncaughtException', (error: Error) => {
    // 不保存配置：崩溃时避免写入可能损坏的数据
    logger.catch(error, { action: 'uncaught-exception' })
    void cleanupAndExit('uncaughtException', false, 1)
  })

  process.on('unhandledRejection', (reason: unknown) => {
    // 带上堆栈，避免后台传输/连接失败只留下一条没有上下文的 message。
    logger.catch(reason, { action: 'unhandled-rejection' })
  })

  process.on('SIGTERM', () => {
    void cleanupAndExit('SIGTERM', true, 0)
  })

  process.on('SIGINT', () => {
    void cleanupAndExit('SIGINT', true, 0)
  })
}

function createAndTrackMainWindow(): void {
  resetCloseGuard()
  const theme = getUiSettings().appearance
  const win = createAppWindow(theme)
  setMainWindow(win)
  applyWindowTheme(theme)
  win.once('closed', () => setMainWindow(null))
  win.on('close', (event) => {
    // 真正退出时不再拦截，否则托盘模式会把窗口反复藏回来。
    if (isQuitting()) return

    if (getUiSettings().closeBehavior === CLOSE_BEHAVIOR.TRAY) {
      event.preventDefault()
      win.hide()
      return
    }

    if (requestClose(win, 'close')) {
      event.preventDefault()
    }
  })
}

/** 托盘「显示主界面」与 macOS dock 激活共用：隐藏的窗口重新显示，没有窗口就重建。 */
export function showMainWindow(): void {
  const win = getMainWindow()
  if (!win) {
    createAndTrackMainWindow()
    return
  }
  win.show()
  win.focus()
}

/** 托盘「退出」：有活跃传输时先把窗口拉到前台，交给渲染层的二次确认。 */
export function requestQuitFromTray(): void {
  const win = getMainWindow()
  if (win && requestClose(win, 'quit')) {
    win.show()
    win.focus()
    return
  }

  forceQuit()
  app.quit()
}

export function createMainWindow(): void {
  createAndTrackMainWindow()

  app.on('activate', () => {
    showMainWindow()
  })
}
