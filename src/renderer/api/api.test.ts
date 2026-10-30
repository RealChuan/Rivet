import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileInfo } from '@shared/types/index.js'
import { configApi } from './config.js'
import { dialogApi } from './dialog.js'
import { protocolApi } from './protocol.js'
import { ApiError } from './result.js'
import { transferApi } from './transfer.js'

const FILE: FileInfo = {
  name: 'a.txt',
  type: 'file',
  size: 1,
  modifyTime: 0,
  absolutePath: '/a.txt',
}

function createApiStub() {
  return {
    app: { confirmClose: vi.fn(), setTheme: vi.fn(), onCloseRequested: vi.fn() },
    protocol: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      list: vi.fn(),
      mkdir: vi.fn(),
      rename: vi.fn(),
      delete: vi.fn(),
      copy: vi.fn(),
      move: vi.fn(),
      cancel: vi.fn().mockResolvedValue(undefined),
      calculateFolderStats: vi.fn(),
      cancelCalculateFolderStats: vi.fn().mockResolvedValue(undefined),
      onFolderStatsProgress: vi.fn(),
      onSessionDisconnected: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    transfer: {
      add: vi.fn(),
      cancel: vi.fn(),
      cancelAll: vi.fn(),
      retry: vi.fn(),
      retryAll: vi.fn(),
      getTasks: vi.fn(),
      getConcurrency: vi.fn(),
      setConcurrency: vi.fn(),
      checkLocalFiles: vi.fn(),
      getLastDir: vi.fn(),
      setLastDir: vi.fn(),
      onTasksEnqueued: vi.fn(),
      onProgress: vi.fn(),
      onTaskCompleted: vi.fn(),
      onTaskFailed: vi.fn(),
      onTaskRemoved: vi.fn(),
    },
    dialog: { getPathForFile: vi.fn(), showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
    crypto: { encryptPassword: vi.fn(), decryptPassword: vi.fn() },
    hostKey: { trust: vi.fn() },
    system: {
      getTempDir: vi.fn(),
      getDownloadDir: vi.fn(),
      supportsGlass: vi.fn(),
      generateUuid: vi.fn(),
    },
    window: {
      getState: vi.fn(),
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
      onStateChanged: vi.fn(),
    },
    env: { windowChrome: 'wco' },
  }
}

let api: ReturnType<typeof createApiStub>

beforeEach(() => {
  api = createApiStub()
  Object.defineProperty(window, 'electronAPI', { value: api, configurable: true })
})

describe('protocolApi', () => {
  it('list 成功时返回裸数组', async () => {
    api.protocol.list.mockResolvedValue({ success: true, value: [FILE], error: undefined })

    await expect(protocolApi.list('s1', '/')).resolves.toEqual([FILE])
  })

  it('list 失败时抛 ApiError', async () => {
    api.protocol.list.mockResolvedValue({
      success: false,
      value: undefined,
      error: { code: 'LIST_ERROR', message: 'boom' },
    })

    await expect(protocolApi.list('s1', '/')).rejects.toBeInstanceOf(ApiError)
  })

  it('list 收到 abort 时取消同一个 requestId', () => {
    api.protocol.list.mockReturnValue(new Promise(() => {}))
    const controller = new AbortController()

    void protocolApi.list('s1', '/', controller.signal)
    const [, , requestId] = api.protocol.list.mock.calls[0] as [string, string, string]
    controller.abort()

    expect(api.protocol.cancel).toHaveBeenCalledWith(requestId)
  })
})

describe('configApi', () => {
  it('get 把 null 原样返回', async () => {
    api.config.get.mockResolvedValue({ success: true, value: null, error: null })

    await expect(configApi.get('uiSettings')).resolves.toBeNull()
  })

  it('get 失败时抛 ApiError', async () => {
    api.config.get.mockResolvedValue({
      success: false,
      value: null,
      error: { code: 'CONFIG_ERROR', message: 'x' },
    })

    await expect(configApi.get('uiSettings')).rejects.toMatchObject({ code: 'CONFIG_ERROR' })
  })
})

describe('transferApi', () => {
  it('getTasks 解包 value', async () => {
    api.transfer.getTasks.mockResolvedValue({ success: true, value: [], error: null })

    await expect(transferApi.getTasks()).resolves.toEqual([])
  })
})

describe('dialogApi', () => {
  it('getPathForFile 不经过 IPC', () => {
    api.dialog.getPathForFile.mockReturnValue('/tmp/a')

    expect(dialogApi.getPathForFile(new File([], 'a'))).toBe('/tmp/a')
  })
})
