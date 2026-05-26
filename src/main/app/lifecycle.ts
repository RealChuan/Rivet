import { app, BrowserWindow } from 'electron'
import { logger } from '../utils/index.js'
import { saveConfig, stopAutoSave } from '../stores/index.js'
import { MAIN_WINDOW_ID } from '@shared/constants/index.js'
import { TIMEOUTS } from '@shared/constants/timeouts.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import { sessionManager } from '../services/index.js'
import { WindowManager } from './window-factory.js'

let isCleaningUp = false

export async function disconnectAllSessions(): Promise<void> {
  if (isCleaningUp || sessionManager.count === 0) return
  isCleaningUp = true

  try {
    logger.info(`Disconnecting ${sessionManager.count} active sessions...`)
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
  exitCode: number
): Promise<void> {
  logger.info(`${signalName} received, cleaning up...`)

  try {
    stopAutoSave()
    await disconnectAllSessions()
    if (shouldSaveConfig) {
      saveConfig()
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
      const forceExitTimeout = setTimeout(() => {
        logger.warn(
          'Force exiting after timeout - some sessions may not have disconnected properly'
        )
        app.exit(0)
      }, TIMEOUTS.FORCE_EXIT)

      try {
        stopAutoSave()
        await disconnectAllSessions()
        saveConfig()
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
    logger.catch(error, { action: 'uncaught-exception' })
    void cleanupAndExit('uncaughtException', false, 1)
  })

  process.on('unhandledRejection', (reason: unknown) => {
    const reasonStr = formatErrorMessage(reason)
    logger.error(`Unhandled rejection: ${reasonStr}`)
  })

  process.on('SIGTERM', () => {
    void cleanupAndExit('SIGTERM', true, 0)
  })

  process.on('SIGINT', () => {
    void cleanupAndExit('SIGINT', true, 0)
  })
}

export function createMainWindow(): void {
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
}
