import { vi } from 'vitest'

// === IPC ===
export const ipcMain = {
  handle: vi.fn(),
  removeHandler: vi.fn(),
  on: vi.fn(),
}

export const ipcRenderer = {
  send: vi.fn(),
  invoke: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  postMessage: vi.fn(),
}

// === Dialog ===
export const dialog = {
  showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  showOpenDialog: vi.fn().mockResolvedValue({ filePaths: [], canceled: false }),
  showSaveDialog: vi.fn().mockResolvedValue({ filePath: '', canceled: false }),
}

// === App ===
export const app = {
  getPath: vi.fn((name: string) => {
    const paths: Record<string, string> = {
      home: '/home/user',
      temp: '/tmp',
      userData: '/tmp/rivet-data',
      downloads: '/tmp/downloads',
    }
    return paths[name] ?? '/tmp'
  }),
  getName: vi.fn(() => 'Rivet'),
  isPackaged: vi.fn(() => false),
  getLocale: vi.fn(() => 'zh-CN'),
  on: vi.fn(),
  quit: vi.fn(),
  exit: vi.fn(),
  whenReady: vi.fn().mockResolvedValue(undefined),
}

// === Shell ===
export const shell = {
  openExternal: vi.fn().mockResolvedValue(true),
}

// === BrowserWindow ===
class MockBrowserWindow {
  on = vi.fn()
  once = vi.fn((event: string, callback: () => void) => {
    if (event === 'ready-to-show') setTimeout(callback, 0)
  })
  isDestroyed = vi.fn(() => false)
  show = vi.fn()
  focus = vi.fn()
  close = vi.fn()
  loadURL = vi.fn()
  loadFile = vi.fn()
  webContents = { send: vi.fn(), on: vi.fn(), setWindowOpenHandler: vi.fn() }
  minimize = vi.fn()
  maximize = vi.fn()
  unmaximize = vi.fn()
  isMaximized = vi.fn(() => false)
}

export const BrowserWindow = Object.assign(
  vi.fn(function (this: MockBrowserWindow) {
    Object.assign(this, new MockBrowserWindow())
  }),
  {
    getAllWindows: vi.fn(() => []),
    fromWebContents: vi.fn(() => null),
  }
)

// === SafeStorage ===
export const safeStorage = {
  isEncryptionAvailable: vi.fn(() => false),
  encryptString: vi.fn(() => Buffer.from('encrypted')),
  decryptString: vi.fn(() => 'decrypted'),
}

// === ContextBridge（preload 用）===
export const contextBridge = {
  exposeInMainWorld: vi.fn(),
}
