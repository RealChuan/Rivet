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
  getAppPath: vi.fn(() => '/app'),
  getLocale: vi.fn(() => 'zh-CN'),
  on: vi.fn(),
  quit: vi.fn(),
  exit: vi.fn(),
  whenReady: vi.fn().mockResolvedValue(undefined),
}

// === Shell ===
export const shell = {
  openExternal: vi.fn().mockResolvedValue(true),
  openPath: vi.fn().mockResolvedValue(''),
  showItemInFolder: vi.fn(),
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
  setTitleBarOverlay = vi.fn()
}

export const BrowserWindow = Object.assign(
  vi.fn(function (this: MockBrowserWindow) {
    Object.assign(this, new MockBrowserWindow())
  }),
  {
    getAllWindows: vi.fn(() => []),
    fromWebContents: vi.fn(() => null),
  },
)

// === NativeTheme ===
export const nativeTheme = {
  themeSource: 'system',
  shouldUseDarkColors: false,
  on: vi.fn(),
}

// === SafeStorage ===
export const safeStorage = {
  isAsyncEncryptionAvailable: vi.fn(() => Promise.resolve(false)),
  encryptStringAsync: vi.fn(() => Promise.resolve(Buffer.from('encrypted'))),
  decryptStringAsync: vi.fn(() => Promise.resolve({ result: 'decrypted', shouldReEncrypt: false })),
}

// === ContextBridge（preload 用）===
export const contextBridge = {
  exposeInMainWorld: vi.fn(),
}

// === Clipboard ===
export const clipboard = {
  writeText: vi.fn(() => Promise.resolve()),
  readText: vi.fn(() => ''),
}

// === Notification ===
export interface MockNotification {
  title: string
  body: string
  on: ReturnType<typeof vi.fn>
  show: ReturnType<typeof vi.fn>
}

/** 测试断言用：每次构造都记录下来。 */
export const notifications: MockNotification[] = []

export const Notification = Object.assign(
  vi.fn(function (this: MockNotification, options: { title: string; body: string }) {
    this.title = options.title
    this.body = options.body
    this.on = vi.fn()
    this.show = vi.fn()
    notifications.push(this)
  }),
  { isSupported: vi.fn(() => true) },
)

// === Tray / Menu ===
export interface MockTray {
  setToolTip: ReturnType<typeof vi.fn>
  setContextMenu: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
}

/** 测试断言用：托盘实例。 */
export const trays: MockTray[] = []

export const Tray = vi.fn(function (this: MockTray) {
  this.setToolTip = vi.fn()
  this.setContextMenu = vi.fn()
  this.on = vi.fn()
  this.destroy = vi.fn()
  trays.push(this)
})

export const Menu = {
  buildFromTemplate: vi.fn((template: unknown) => ({ template })),
}

export const nativeImage = {
  createFromBitmap: vi.fn(() => ({ setTemplateImage: vi.fn() })),
  createFromBuffer: vi.fn(() => ({ addRepresentation: vi.fn() })),
}
