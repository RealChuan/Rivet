import { app, BrowserWindow } from 'electron'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'
import logger from './logger.js'
import { setupIpcHandlers } from './ipcHandlers.js'
import { loadConfig, saveConfig } from './store.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  logger.info('Main window created')
}

app.whenReady().then(() => {
  logger.info('App ready, starting initialization')

  loadConfig()

  setupIpcHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
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
