/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
/* eslint-disable @typescript-eslint/no-unsafe-return -- mock 工厂函数透传 any 参数 */
/* eslint-disable @typescript-eslint/require-await -- vitest it() 保持 async 签名一致性 */
/* eslint-disable @typescript-eslint/consistent-type-imports -- typeof import() 用于获取值导出的类型 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRegisterWindowMeta = vi.fn()
const mockUnregisterWindowMeta = vi.fn()

vi.mock('../utils/window-meta.js', () => ({
  registerWindowMeta: (...args: unknown[]) => mockRegisterWindowMeta(...args),
  unregisterWindowMeta: (...args: unknown[]) => mockUnregisterWindowMeta(...args),
}))

vi.mock('../utils/index.js', () => ({
  supportsGlassEffect: vi.fn(() => false),
}))

vi.mock('@shared/constants/index.js', async importOriginal => {
  const actual: Record<string, unknown> = await importOriginal()
  return {
    ...actual,
    IPC_CHANNELS: {
      WINDOW: {
        STATE_CHANGED: 'window-state-changed',
      },
      EVENTS: {},
    },
  }
})

vi.mock('node:path', () => {
  const path = {
    join: vi.fn(() => '/mocked/preload/path'),
  }
  return { default: path, ...path }
})

vi.mock('node:url', () => {
  return {
    fileURLToPath: vi.fn(() => '/mocked/dirname'),
    URL: class MockURL {
      constructor(_href: string, _base?: string) {}
    },
    default: {
      fileURLToPath: vi.fn(() => '/mocked/dirname'),
      URL: class MockURL {
        constructor(_href: string, _base?: string) {}
      },
    },
  }
})

describe('window-factory', () => {
  let createFramelessWindow: typeof import('./window-factory.js').createFramelessWindow
  let WindowManager: typeof import('./window-factory.js').WindowManager

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./window-factory.js')
    createFramelessWindow = module.createFramelessWindow
    WindowManager = module.WindowManager
  })

  describe('createFramelessWindow', () => {
    it('should create a BrowserWindow with default options', () => {
      const win = createFramelessWindow({ id: 'test-window' })

      expect(win).toBeDefined()
      expect(win.show).not.toHaveBeenCalled()
    })

    it('should call ready-to-show handler to show and focus window', () => {
      const win = createFramelessWindow({ id: 'ready-window' })

      expect(win.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function))
    })

    it('should register maximize event handler', () => {
      const win = createFramelessWindow({ id: 'maximize-window' })

      expect(win.on).toHaveBeenCalledWith('maximize', expect.any(Function))
    })

    it('should register unmaximize event handler', () => {
      const win = createFramelessWindow({ id: 'unmaximize-window' })

      expect(win.on).toHaveBeenCalledWith('unmaximize', expect.any(Function))
    })
  })

  describe('WindowManager.create', () => {
    it('should create and register a new window', () => {
      const win = WindowManager.create({ id: 'new-window' })

      expect(win).toBeDefined()
      expect(mockRegisterWindowMeta).toHaveBeenCalled()
    })

    it('should call registerWindowMeta with correct parameters', () => {
      WindowManager.create({ id: 'meta-window', route: '/test-route' })

      expect(mockRegisterWindowMeta).toHaveBeenCalledWith(
        expect.any(Object),
        'meta-window',
        '/test-route'
      )
    })

    it('should focus existing window if not destroyed', () => {
      const win1 = WindowManager.create({ id: 'reuse-window' })
      const win2 = WindowManager.create({ id: 'reuse-window' })

      expect(win1).toBe(win2)
      expect(win1.focus).toHaveBeenCalled()
    })
  })

  describe('WindowManager.get', () => {
    it('should return undefined for non-existent id', () => {
      const win = WindowManager.get('non-existent')
      expect(win).toBeUndefined()
    })

    it('should return created window by id', () => {
      const createdWin = WindowManager.create({ id: 'get-test-window' })
      const retrievedWin = WindowManager.get('get-test-window')

      expect(retrievedWin).toBe(createdWin)
    })
  })

  describe('WindowManager.close', () => {
    it('should close window by id', () => {
      const win = WindowManager.create({ id: 'close-test-window' })
      WindowManager.close('close-test-window')

      expect(win.close).toHaveBeenCalled()
      expect(WindowManager.get('close-test-window')).toBeUndefined()
    })

    it('should handle closing non-existent window gracefully', () => {
      expect(() => WindowManager.close('non-existent')).not.toThrow()
    })
  })

  describe('WindowManager.getAll', () => {
    it('should return all created windows', () => {
      const win1 = WindowManager.create({ id: 'getall-win-1' })
      const win2 = WindowManager.create({ id: 'getall-win-2' })

      const allWindows = WindowManager.getAll()

      expect(allWindows).toContain(win1)
      expect(allWindows).toContain(win2)
    })

    it('should only return non-destroyed windows', async () => {
      const win1 = WindowManager.create({ id: 'filter-win-1' })
      WindowManager.create({ id: 'filter-win-2' })

      win1.isDestroyed = vi.fn(() => true)

      const allWindows = WindowManager.getAll()
      expect(allWindows).not.toContain(win1)
    })
  })

  describe('WindowManager.broadcast', () => {
    it('should send message to all windows', () => {
      const win1 = WindowManager.create({ id: 'broadcast-1' })
      WindowManager.create({ id: 'broadcast-2' })

      WindowManager.broadcast('test-channel' as never, 'arg1', 'arg2')

      expect(win1.webContents.send).toHaveBeenCalledWith('test-channel', 'arg1', 'arg2')
    })

    it('should do nothing when no windows exist', () => {
      expect(() => WindowManager.broadcast('empty-channel' as never)).not.toThrow()
    })
  })
})
