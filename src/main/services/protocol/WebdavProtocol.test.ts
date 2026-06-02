import type * as fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROTOCOL, ProtocolStatus } from '@shared/constants/index.js'
import { type ConnectionConfig } from '@shared/types/index.js'
import { WebdavProtocol } from './WebdavProtocol.js'

// 使用 vi.hoisted 确保 mock 对象在 vi.mock 提升前可用
const {
  mockWebdavClient,
  mockHttpAgent,
  mockHttpsAgent,
  mockSessionRegistry,
  mockCreateClient,
  mockHttpAgentCtor,
  mockHttpsAgentCtor,
} = vi.hoisted(() => {
  const mockWebdavClient = {
    getDirectoryContents: vi.fn(),
    createDirectory: vi.fn(),
    moveFile: vi.fn(),
    deleteFile: vi.fn(),
    copyFile: vi.fn(),
    stat: vi.fn(),
    putFileContents: vi.fn(),
  }
  const mockCreateClient = vi.fn().mockReturnValue(mockWebdavClient)
  const mockHttpAgent = { destroy: vi.fn() }
  const mockHttpsAgent = { destroy: vi.fn() }
  const mockHttpAgentCtor = vi.fn().mockImplementation(function () {
    return mockHttpAgent
  })
  const mockHttpsAgentCtor = vi.fn().mockImplementation(function () {
    return mockHttpsAgent
  })
  const mockSessionRegistry = {
    register: vi.fn(),
    unregister: vi.fn(),
    get: vi.fn().mockReturnValue(null),
    setClosing: vi.fn(),
  }
  return {
    mockWebdavClient,
    mockHttpAgent,
    mockHttpsAgent,
    mockSessionRegistry,
    mockCreateClient,
    mockHttpAgentCtor,
    mockHttpsAgentCtor,
  }
})

vi.mock('webdav', () => ({
  createClient: mockCreateClient,
}))

vi.mock('node:http', async importOriginal => {
  const actual = await importOriginal()
  return {
    default: {
      ...(typeof actual === 'object' && actual !== null ? actual : {}),
      Agent: mockHttpAgentCtor,
    },
    Agent: mockHttpAgentCtor,
  }
})

vi.mock('node:https', async importOriginal => {
  const actual = await importOriginal()
  return {
    default: {
      ...(typeof actual === 'object' && actual !== null ? actual : {}),
      Agent: mockHttpsAgentCtor,
    },
    Agent: mockHttpsAgentCtor,
  }
})

const { mockFs } = vi.hoisted(() => {
  const mockReadStream = {
    on: vi.fn().mockReturnThis(),
    pipe: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  }
  const mockFs = {
    promises: {
      stat: vi.fn().mockResolvedValue({ size: 1024 }),
    },
    createReadStream: vi.fn().mockReturnValue(mockReadStream),
    _mockReadStream: mockReadStream,
  }
  return { mockFs }
})

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof fs>()
  return {
    ...actual,
    default: {
      ...actual,
      promises: {
        ...(typeof actual.promises === 'object' && actual.promises !== null ? actual.promises : {}),
        stat: mockFs.promises.stat,
      },
      createReadStream: mockFs.createReadStream,
    },
  }
})

vi.mock('../session-registry', () => ({
  sessionRegistry: mockSessionRegistry,
}))

vi.mock('@main/utils/index.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), catch: vi.fn() },
  generateSessionId: vi.fn(() => 'webdav_test_session'),
}))

vi.mock('@main/utils/encryption.js', () => ({
  encryptPassword: vi.fn(),
  decryptPassword: vi.fn(),
}))

vi.mock('@main/utils/system.js', () => ({
  getTempDir: vi.fn(),
  getDownloadDir: vi.fn(),
}))

vi.mock('@main/utils/dialog.js', () => ({
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
}))

vi.mock('@main/utils/window-meta.js', () => ({
  registerWindowMeta: vi.fn(),
  unregisterWindowMeta: vi.fn(),
  getWindowMeta: vi.fn(),
}))

// exactOptionalPropertyTypes: true 下不能写 password: undefined，省略即可
const baseConfig: ConnectionConfig = {
  id: 'test-conn-id',
  name: 'Test WebDAV',
  protocol: PROTOCOL.WEBDAV,
  host: 'webdav.example.com',
  port: 443,
  username: 'testuser',
  scheme: 'https',
  basePath: '/dav',
  rejectUnauthorized: true,
}

describe('WebdavProtocol', () => {
  let webdav: WebdavProtocol

  beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks 会重置 mock 实现，需要重新设置
    mockCreateClient.mockReturnValue(mockWebdavClient)
    mockHttpAgentCtor.mockImplementation(function () {
      return mockHttpAgent
    })
    mockHttpsAgentCtor.mockImplementation(function () {
      return mockHttpsAgent
    })
    webdav = new WebdavProtocol()
    mockWebdavClient.getDirectoryContents.mockResolvedValue([])
    mockWebdavClient.createDirectory.mockResolvedValue(undefined)
    mockWebdavClient.moveFile.mockResolvedValue(undefined)
    mockWebdavClient.deleteFile.mockResolvedValue(undefined)
    mockWebdavClient.copyFile.mockResolvedValue(undefined)
    mockWebdavClient.stat.mockResolvedValue({ type: 'directory' })
    mockWebdavClient.putFileContents.mockResolvedValue(undefined)
    mockFs.promises.stat.mockResolvedValue({ size: 1024 })
    mockFs.createReadStream.mockReturnValue(mockFs._mockReadStream)
  })

  /** 注册一个模拟会话，使公共方法（list/mkdir/...）可通过 sessionId 获取 mockWebdavClient */
  function setupSession() {
    const mockController = { abort: vi.fn() }
    const webdavSession = {
      client: mockWebdavClient,
      controller: mockController,
      agent: mockHttpsAgent,
    }
    mockSessionRegistry.get.mockReturnValue({
      client: webdavSession,
      config: baseConfig,
      protocolType: PROTOCOL.WEBDAV,
    })
    return { mockController }
  }

  describe('connect', () => {
    it('should connect successfully via HTTPS', async () => {
      const result = await webdav.connect(baseConfig, 'testpass')
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.value.statusCode).toBe(ProtocolStatus.OK)
      expect(result.value.sessionId).toBeTruthy()
    })

    it('should connect successfully via HTTP', async () => {
      const httpConfig = { ...baseConfig, scheme: 'http' as const, port: 80 }
      const result = await webdav.connect(httpConfig, 'testpass')
      expect(result.success).toBe(true)
    })

    it('should handle connection refused', async () => {
      mockWebdavClient.getDirectoryContents.mockRejectedValue(
        new Error('connect ECONNREFUSED 192.168.1.1:443')
      )
      const result = await webdav.connect(baseConfig, 'testpass')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('CONN_FAILED')
      expect(result.error.message).toContain('ECONNREFUSED')
    })

    it('should handle SSL certificate error', async () => {
      mockWebdavClient.getDirectoryContents.mockRejectedValue(
        new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE')
      )
      const result = await webdav.connect(baseConfig, 'testpass')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('CONN_FAILED')
    })

    it('should handle 401 unauthorized', async () => {
      mockWebdavClient.getDirectoryContents.mockRejectedValue(new Error('Unauthorized'))
      const result = await webdav.connect(baseConfig, 'testpass')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('CONN_FAILED')
    })

    it('should handle connection timeout', async () => {
      mockWebdavClient.getDirectoryContents.mockRejectedValue(new Error('request timeout'))
      const result = await webdav.connect(baseConfig, 'testpass')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('CONN_FAILED')
    })

    it('should handle DNS resolution failure', async () => {
      mockWebdavClient.getDirectoryContents.mockRejectedValue(
        new Error('getaddrinfo ENOTFOUND nonexistent.example.com')
      )
      const result = await webdav.connect(baseConfig, 'testpass')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('CONN_FAILED')
    })

    it('should destroy agent on connection failure', async () => {
      mockWebdavClient.getDirectoryContents.mockRejectedValue(new Error('Connection failed'))
      const result = await webdav.connect(baseConfig, 'testpass')
      expect(result.success).toBe(false)
      // Agent destroy 是在 connect 的 catch 块中调用的
      // 需要验证 https.Agent 构造函数被调用并返回了 mockHttpsAgent
      expect(mockHttpsAgentCtor).toHaveBeenCalled()
      expect(mockHttpsAgent.destroy).toHaveBeenCalled()
    })
  })

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      setupSession()

      const result = await webdav.disconnect('webdav_test_session')
      expect(result.success).toBe(true)
      expect(mockSessionRegistry.unregister).toHaveBeenCalledWith('webdav_test_session')
    })

    it('should handle disconnect when session not found', async () => {
      mockSessionRegistry.get.mockReturnValue(null)
      const result = await webdav.disconnect('nonexistent')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('SESSION_NOT_FOUND')
    })

    it('should abort controller and destroy agent on disconnect', async () => {
      const { mockController } = setupSession()

      await webdav.disconnect('webdav_test_session')
      expect(mockController.abort).toHaveBeenCalled()
      expect(mockHttpsAgent.destroy).toHaveBeenCalled()
    })

    it('should always unregister session even on disconnect error', async () => {
      const webdavSession = {
        client: mockWebdavClient,
        controller: {
          abort: vi.fn(() => {
            throw new Error('Abort failed')
          }),
        },
        agent: { destroy: vi.fn() },
      }
      mockSessionRegistry.get.mockReturnValue({
        client: webdavSession,
        config: baseConfig,
        protocolType: PROTOCOL.WEBDAV,
      })

      await webdav.disconnect('webdav_test_session')
      expect(mockSessionRegistry.unregister).toHaveBeenCalledWith('webdav_test_session')
    })
  })

  describe('list error handling', () => {
    it('should handle list directory not found', async () => {
      setupSession()
      mockWebdavClient.getDirectoryContents.mockRejectedValue(new Error('Not Found'))
      const result = await webdav.list('webdav_test_session', '/nonexistent')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('LIST_ERROR')
    })

    it('should handle list permission denied', async () => {
      setupSession()
      mockWebdavClient.getDirectoryContents.mockRejectedValue(new Error('403 Forbidden'))
      const result = await webdav.list('webdav_test_session', '/private')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('LIST_ERROR')
      expect(result.error.message).toContain('403')
    })

    it('should handle list connection lost during operation', async () => {
      setupSession()
      mockWebdavClient.getDirectoryContents.mockRejectedValue(new Error('socket hang up'))
      const result = await webdav.list('webdav_test_session', '/home')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('LIST_ERROR')
    })
  })

  describe('mkdir error handling', () => {
    it('should handle mkdir permission denied', async () => {
      setupSession()
      mockWebdavClient.createDirectory.mockRejectedValue(new Error('403 Forbidden'))
      const result = await webdav.mkdir('webdav_test_session', '/newdir')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('MKDIR_ERROR')
    })

    it('should handle mkdir conflict (already exists)', async () => {
      setupSession()
      mockWebdavClient.createDirectory.mockRejectedValue(new Error('405 Method Not Allowed'))
      const result = await webdav.mkdir('webdav_test_session', '/existing')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('MKDIR_ERROR')
    })
  })

  describe('rename error handling', () => {
    it('should handle rename source not found', async () => {
      setupSession()
      mockWebdavClient.moveFile.mockRejectedValue(new Error('404 Not Found'))
      const result = await webdav.rename(
        'webdav_test_session',
        {
          name: 'old',
          type: 'file',
          size: 0,
          modifyTime: 0,
          permissions: '',
          owner: '',
          absolutePath: '/old',
        },
        'new'
      )
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('RENAME_ERROR')
    })

    it('should handle rename permission denied', async () => {
      setupSession()
      mockWebdavClient.moveFile.mockRejectedValue(new Error('403 Forbidden'))
      const result = await webdav.rename(
        'webdav_test_session',
        {
          name: 'old',
          type: 'file',
          size: 0,
          modifyTime: 0,
          permissions: '',
          owner: '',
          absolutePath: '/old',
        },
        'new'
      )
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('RENAME_ERROR')
    })
  })

  describe('delete error handling', () => {
    it('should handle delete file not found', async () => {
      setupSession()
      mockWebdavClient.deleteFile.mockRejectedValue(new Error('404 Not Found'))
      const result = await webdav.delete('webdav_test_session', {
        name: 'nonexistent',
        type: 'file',
        size: 0,
        modifyTime: 0,
        permissions: '',
        owner: '',
        absolutePath: '/nonexistent',
      })
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('DELETE_ERROR')
    })

    it('should handle delete permission denied', async () => {
      setupSession()
      mockWebdavClient.deleteFile.mockRejectedValue(new Error('403 Forbidden'))
      const result = await webdav.delete('webdav_test_session', {
        name: 'protected',
        type: 'file',
        size: 0,
        modifyTime: 0,
        permissions: '',
        owner: '',
        absolutePath: '/protected',
      })
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('DELETE_ERROR')
    })
  })

  describe('copy error handling', () => {
    it('should handle copy error', async () => {
      setupSession()
      mockWebdavClient.copyFile.mockRejectedValue(new Error('507 Insufficient Storage'))
      const result = await webdav.copy(
        'webdav_test_session',
        {
          name: 'src',
          type: 'file',
          size: 0,
          modifyTime: 0,
          permissions: '',
          owner: '',
          absolutePath: '/src',
        },
        '/dst'
      )
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('COPY_ERROR')
    })
  })

  describe('move error handling', () => {
    it('should handle move error', async () => {
      setupSession()
      mockWebdavClient.moveFile.mockRejectedValue(new Error('409 Conflict'))
      const result = await webdav.move(
        'webdav_test_session',
        {
          name: 'src',
          type: 'file',
          size: 0,
          modifyTime: 0,
          permissions: '',
          owner: '',
          absolutePath: '/src',
        },
        '/dst'
      )
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('MOVE_ERROR')
    })
  })

  describe('ping error handling', () => {
    it('should handle ping failure', async () => {
      setupSession()
      mockWebdavClient.stat.mockRejectedValue(new Error('Connection lost'))
      const result = await webdav.ping('webdav_test_session')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('PING_ERROR')
    })
  })

  describe('upload', () => {
    it('should upload file successfully', async () => {
      setupSession()
      const onProgress = vi.fn()
      const result = await webdav.upload(
        'webdav_test_session',
        '/local/file.txt',
        '/remote/file.txt',
        onProgress
      )
      expect(result.success).toBe(true)
      expect(mockWebdavClient.putFileContents).toHaveBeenCalledWith(
        '/dav/remote/file.txt',
        expect.anything(),
        expect.objectContaining({ contentLength: 1024, overwrite: true })
      )
    })

    it('should handle upload failure', async () => {
      setupSession()
      mockWebdavClient.putFileContents.mockRejectedValue(new Error('507 Insufficient Storage'))
      const onProgress = vi.fn()
      const result = await webdav.upload(
        'webdav_test_session',
        '/local/file.txt',
        '/remote/file.txt',
        onProgress
      )
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('UPLOAD_ERROR')
    })
  })
})
