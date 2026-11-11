import { webUtils } from 'electron'
import type { ElectronAPI } from '@shared/contract/index.js'
import { isWindowChromeMode, type WindowChromeMode } from '@shared/types/window-chrome.js'
import { subscribe } from './events.js'
import { invoke, send } from './invoke.js'

function readWindowChrome(): WindowChromeMode {
  const prefix = '--rivet-window-chrome='
  const arg = process.argv.find((value) => value.startsWith(prefix))
  const mode = arg?.slice(prefix.length)
  return isWindowChromeMode(mode) ? mode : 'custom'
}

/**
 * 只做三件事：把契约映射成方法、绑定事件订阅、暴露同步的 `getPathForFile`。
 * 任何业务逻辑都不允许出现在 preload。
 */
export const electronAPI = {
  app: {
    confirmClose: () => invoke('app.confirmClose'),
    setTheme: (theme) => send('app.setTheme', theme),
    setLocale: (locale) => send('app.setLocale', locale),
    onCloseRequested: (callback) => subscribe('app.closeRequested', callback),
    onCleanupStarted: (callback) => subscribe('app.cleanupStarted', callback),
  },

  clipboard: {
    writeText: (text) => invoke('clipboard.writeText', text),
    readText: () => invoke('clipboard.readText'),
  },

  protocol: {
    connect: (config) => invoke('protocol.connect', config),
    disconnect: (sessionId, requestId) => invoke('protocol.disconnect', sessionId, requestId),
    listBuckets: (request) => invoke('protocol.listBuckets', request),
    list: (sessionId, path, requestId, limit) =>
      invoke('protocol.list', sessionId, path, requestId, limit),
    stat: (sessionId, path, requestId) => invoke('protocol.stat', sessionId, path, requestId),
    mkdir: (sessionId, path, requestId) => invoke('protocol.mkdir', sessionId, path, requestId),
    rename: (sessionId, file, newName, requestId) =>
      invoke('protocol.rename', sessionId, file, newName, requestId),
    chmod: (sessionId, file, mode, requestId) =>
      invoke('protocol.chmod', sessionId, file, mode, requestId),
    delete: (sessionId, file, requestId) => invoke('protocol.delete', sessionId, file, requestId),
    copy: (sessionId, file, targetPath, requestId) =>
      invoke('protocol.copy', sessionId, file, targetPath, requestId),
    move: (sessionId, file, targetPath, requestId) =>
      invoke('protocol.move', sessionId, file, targetPath, requestId),
    cancel: (requestId) => invoke('protocol.cancel', requestId),
    calculateFolderStats: (sessionId, path) =>
      invoke('protocol.calculateFolderStats', sessionId, path),
    cancelCalculateFolderStats: (sessionId) =>
      invoke('protocol.cancelCalculateFolderStats', sessionId),
    onSessionDisconnected: (callback) => subscribe('protocol.sessionDisconnected', callback),
    onFolderStatsProgress: (callback) => subscribe('protocol.folderStatsProgress', callback),
  },

  config: {
    get: (key) => invoke('config.get', key),
    set: (key, value) => invoke('config.set', key, value),
  },

  dialog: {
    getPathForFile: (file) => webUtils.getPathForFile(file),
    showOpenDialog: (options) => invoke('dialog.showOpenDialog', options),
    showSaveDialog: (options) => invoke('dialog.showSaveDialog', options),
  },

  hostKey: {
    trust: (record) => invoke('hostKey.trust', record),
  },
  window: {
    getState: () => invoke('window.getState'),
    minimize: () => send('window.minimize'),
    toggleMaximize: () => send('window.toggleMaximize'),
    close: () => send('window.close'),
    onStateChanged: (callback) => subscribe('window.stateChanged', callback),
  },

  system: {
    getTempDir: () => invoke('system.getTempDir'),
    getDownloadDir: () => invoke('system.getDownloadDir'),
    supportsGlass: () => invoke('system.supportsGlass'),
    generateUuid: () => invoke('system.generateUuid'),
    getLogDir: () => invoke('system.getLogDir'),
    getLogCacheSize: () => invoke('system.getLogCacheSize'),
    clearLogCache: () => invoke('system.clearLogCache'),
    openLogDir: () => invoke('system.openLogDir'),
  },

  terminal: {
    open: (request) => invoke('terminal.open', request),
    close: (terminalId) => invoke('terminal.close', terminalId),
    // 键盘输入与尺寸变化走单向通道：按键不该等一个 Promise 往返。
    write: (terminalId, data) => send('terminal.write', terminalId, data),
    resize: (terminalId, cols, rows) => send('terminal.resize', terminalId, cols, rows),
    onData: (callback) => subscribe('terminal.data', callback),
    onExit: (callback) => subscribe('terminal.exit', callback),
  },

  env: {
    windowChrome: readWindowChrome(),
  },

  transfer: {
    add: (tasks) => invoke('transfer.add', tasks),
    cancel: (taskId) => invoke('transfer.cancel', taskId),
    cancelAll: (sessionId) => invoke('transfer.cancelAll', sessionId),
    retry: (taskId) => invoke('transfer.retry', taskId),
    retryAll: (sessionId) => invoke('transfer.retryAll', sessionId),
    pause: (taskId) => invoke('transfer.pause', taskId),
    resume: (taskId) => invoke('transfer.resume', taskId),
    getTasks: (sessionId) => invoke('transfer.getTasks', sessionId),
    getConcurrency: (direction) => invoke('transfer.getConcurrency', direction),
    setConcurrency: (max, direction) => invoke('transfer.setConcurrency', max, direction),
    checkLocalFiles: (localDir) => invoke('transfer.checkLocalFiles', localDir),
    getLastDir: (key) => invoke('transfer.getLastDir', key),
    setLastDir: (key, dir) => invoke('transfer.setLastDir', key, dir),
    onTasksEnqueued: (callback) => subscribe('transfer.tasksEnqueued', callback),
    onProgress: (callback) => subscribe('transfer.progress', callback),
    onTaskCompleted: (callback) => subscribe('transfer.taskCompleted', callback),
    onTaskFailed: (callback) => subscribe('transfer.taskFailed', callback),
    onTaskStatusChanged: (callback) => subscribe('transfer.taskStatusChanged', callback),
    onTaskRemoved: (callback) => subscribe('transfer.taskRemoved', callback),
  },
} satisfies ElectronAPI
