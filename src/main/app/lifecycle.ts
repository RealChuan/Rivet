import { app, BrowserWindow } from 'electron'
import { TIMEOUTS } from '@shared/constants/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import { sessionManager, sessionRegistry } from '../services/index.js'
import { flushStores, getUiSettings } from '../stores/index.js'
import { logger } from '../utils/index.js'
import { isCloseConfirmed, requestClose, resetCloseGuard } from './close-guard.js'
import { getMainWindow, setMainWindow } from './main-window.js'
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

export async function cleanupAndExit(
  signalName: string,
  shouldSaveConfig: boolean,
  exitCode: number,
): Promise<void> {
  logger.info(`${signalName} received, cleaning up...`)

  try {
    await disconnectAllSessions()
    if (shouldSaveConfig) {
      await flushStores()
    }
  } finally {
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
        await flushStores()
      } catch (error: unknown) {
        const errMsg = formatErrorMessage(error)
        logger.error(`Error during quit cleanup: ${errMsg}`)
      } finally {
        clearTimeout(forceExitTimeout)
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
    if (requestClose(win, 'close')) {
      event.preventDefault()
    }
  })
}

export function createMainWindow(): void {
  createAndTrackMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createAndTrackMainWindow()
    }
  })
}
