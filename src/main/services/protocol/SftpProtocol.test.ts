import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SftpProtocol } from './SftpProtocol.js'
import { type ConnectionConfig } from '@shared/types/index.js'
import { PROTOCOL_SFTP, SftpStatus } from '@shared/constants/index.js'

// 使用 vi.hoisted 确保 mock 对象在 vi.mock 提升前可用
const { mockClient, mockSessionManager, mockSftpConstructor } = vi.hoisted(() => {
  const mockClient = {
    connect: vi.fn(),
    end: vi.fn(),
    list: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
    stat: vi.fn(),
    delete: vi.fn(),
    rmdir: vi.fn(),
    rcopy: vi.fn(),
  }
  const mockSftpConstructor = vi.fn().mockImplementation(function () {
    return mockClient
  })
  const mockSessionManager = {
    register: vi.fn(),
    unregister: vi.fn(),
    get: vi.fn().mockReturnValue(null),
    setClosing: vi.fn(),
  }
  return { mockClient, mockSessionManager, mockSftpConstructor }
})

vi.mock('ssh2-sftp-client', () => {
  return {
    default: mockSftpConstructor,
  }
})

vi.mock('../session-manager', () => ({
  sessionManager: mockSessionManager,
}))

vi.mock('../../stores/index', () => ({
  getHostKeyRecord: vi.fn().mockReturnValue({ success: false }),
}))

vi.mock('@main/utils/index.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), catch: vi.fn() },
  generateSessionId: vi.fn(() => 'sftp_test_session'),
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
  name: 'Test SFTP',
  protocol: PROTOCOL_SFTP,
  host: 'sftp.example.com',
  port: 22,
  username: 'testuser',
}

describe('SftpProtocol', () => {
  let sftp: SftpProtocol

  beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks 会重置 constructor 的 mockImplementation，需要重新设置
    mockSftpConstructor.mockImplementation(function () {
      return mockClient
    })
    sftp = new SftpProtocol()
    mockClient.connect.mockResolvedValue(undefined)
    mockClient.end.mockResolvedValue(undefined)
    mockClient.list.mockResolvedValue([])
    mockClient.mkdir.mockResolvedValue(undefined)
    mockClient.rename.mockResolvedValue(undefined)
    mockClient.stat.mockResolvedValue({ isDirectory: false })
    mockClient.delete.mockResolvedValue(undefined)
    mockClient.rmdir.mockResolvedValue(undefined)
    mockClient.rcopy.mockResolvedValue(undefined)
  })

  /** 注册一个模拟会话，使公共方法（list/mkdir/...）可通过 sessionId 获取 mockClient */
  function setupSession() {
    mockSessionManager.get.mockReturnValue({
      client: mockClient,
      config: baseConfig,
      protocolType: PROTOCOL_SFTP,
    })
  }

  describe('connect', () => {
    it('should connect successfully on first connection (no host key)', async () => {
      const result = await sftp.connect(baseConfig, 'testpass')
      expect(result.success).toBe(true)
      if (!result.success) return
      // mock connect 不会调用 hostVerifier，所以 status 默认为 OK
      expect(result.value.sessionId).toBeTruthy()
    })

    it('should handle connection timeout', async () => {
      mockClient.connect.mockRejectedValue(new Error('Timed out while waiting for handshake'))
      const result = await sftp.connect(baseConfig, 'testpass')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('CONN_FAILED')
      expect(result.error.message).toContain('Timed out')
    })

    it('should handle authentication failure', async () => {
      mockClient.connect.mockRejectedValue(
        new Error('All configured authentication methods failed')
      )
      const result = await sftp.connect(baseConfig, 'testpass')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('CONN_FAILED')
      expect(result.error.message).toContain('authentication')
    })

    it('should handle connection refused', async () => {
      mockClient.connect.mockRejectedValue(new Error('connect ECONNREFUSED'))
      const result = await sftp.connect(baseConfig, 'testpass')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('CONN_FAILED')
    })

    it('should handle network unreachable', async () => {
      mockClient.connect.mockRejectedValue(new Error('connect ENETUNREACH'))
      const result = await sftp.connect(baseConfig, 'testpass')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('CONN_FAILED')
    })

    it('should handle host key mismatch', async () => {
      const { getHostKeyRecord } = await import('../../stores/index.js')
      vi.mocked(getHostKeyRecord).mockReturnValue({
        success: true,
        value: { connectionId: 'test-conn-id', hash: 'old-hash', createdAt: Date.now() },
        error: null,
      })
      // Mock connect to call hostVerifier with a different hash, then reject
      mockClient.connect.mockImplementation((options: Record<string, unknown>) => {
        const verifier = options.hostVerifier as ((hash: string) => boolean) | undefined
        if (verifier) {
          verifier('new-hash')
        }
        throw new Error('Host key verification failed')
      })

      const result = await sftp.connect(baseConfig, 'testpass')
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.value.statusCode).toBe(SftpStatus.HOST_KEY_MISMATCH)
    })

    it('should close client on connection failure', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'))
      await sftp.connect(baseConfig, 'testpass')
      expect(mockClient.end).toHaveBeenCalled()
    })

    it('should handle client.end() failure during connect cleanup', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'))
      mockClient.end.mockRejectedValue(new Error('Already closed'))
      const result = await sftp.connect(baseConfig, 'testpass')
      expect(result.success).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      setupSession()

      const result = await sftp.disconnect('sftp_test_session')
      expect(result.success).toBe(true)
      expect(mockSessionManager.unregister).toHaveBeenCalledWith('sftp_test_session')
    })

    it('should handle disconnect when session not found', async () => {
      mockSessionManager.get.mockReturnValue(null)
      const result = await sftp.disconnect('nonexistent')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('SESSION_NOT_FOUND')
    })

    it('should handle client.end() error gracefully', async () => {
      setupSession()
      mockClient.end.mockRejectedValue(new Error('Connection already closed'))

      const result = await sftp.disconnect('sftp_test_session')
      expect(mockSessionManager.unregister).toHaveBeenCalledWith('sftp_test_session')
      expect(result.success).toBe(true)
    })

    it('should always unregister session even on error', async () => {
      setupSession()
      mockClient.end.mockRejectedValue(new Error('Force close error'))

      await sftp.disconnect('sftp_test_session')
      expect(mockSessionManager.unregister).toHaveBeenCalledWith('sftp_test_session')
    })
  })

  describe('list error handling', () => {
    it('should handle list directory not found', async () => {
      setupSession()
      mockClient.list.mockRejectedValue(new Error('No such file'))
      const result = await sftp.list('sftp_test_session', '/nonexistent')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('LIST_ERROR')
    })

    it('should handle list permission denied', async () => {
      setupSession()
      mockClient.list.mockRejectedValue(new Error('Permission denied'))
      const result = await sftp.list('sftp_test_session', '/root')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('LIST_ERROR')
      expect(result.error.message).toContain('Permission denied')
    })

    it('should handle list connection lost during operation', async () => {
      setupSession()
      mockClient.list.mockRejectedValue(new Error('Connection lost'))
      const result = await sftp.list('sftp_test_session', '/home')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('LIST_ERROR')
    })
  })

  describe('mkdir error handling', () => {
    it('should handle mkdir permission denied', async () => {
      setupSession()
      mockClient.mkdir.mockRejectedValue(new Error('Permission denied'))
      const result = await sftp.mkdir('sftp_test_session', '/root/newdir')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('MKDIR_ERROR')
    })

    it('should handle mkdir already exists', async () => {
      setupSession()
      mockClient.mkdir.mockRejectedValue(new Error('Directory already exists'))
      const result = await sftp.mkdir('sftp_test_session', '/home/existing')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('MKDIR_ERROR')
    })
  })

  describe('rename error handling', () => {
    it('should handle rename source not found', async () => {
      setupSession()
      mockClient.rename.mockRejectedValue(new Error('No such file'))
      const result = await sftp.rename(
        'sftp_test_session',
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
      mockClient.rename.mockRejectedValue(new Error('Permission denied'))
      const result = await sftp.rename(
        'sftp_test_session',
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
      mockClient.stat.mockRejectedValue(new Error('No such file'))
      const result = await sftp.delete('sftp_test_session', {
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

    it('should handle delete directory (rmdir) error', async () => {
      setupSession()
      mockClient.stat.mockResolvedValue({ isDirectory: true })
      mockClient.rmdir.mockRejectedValue(new Error('Directory not empty'))
      const result = await sftp.delete('sftp_test_session', {
        name: 'nonempty',
        type: 'directory',
        size: 0,
        modifyTime: 0,
        permissions: '',
        owner: '',
        absolutePath: '/nonempty',
      })
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('DELETE_ERROR')
    })

    it('should handle delete permission denied', async () => {
      setupSession()
      mockClient.stat.mockResolvedValue({ isDirectory: false })
      mockClient.delete.mockRejectedValue(new Error('Permission denied'))
      const result = await sftp.delete('sftp_test_session', {
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
    it('should handle copy file error', async () => {
      setupSession()
      mockClient.stat.mockResolvedValue({ isDirectory: false })
      mockClient.rcopy.mockRejectedValue(new Error('Copy failed'))
      const result = await sftp.copy(
        'sftp_test_session',
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

    it('should handle copy directory stat error', async () => {
      setupSession()
      mockClient.stat.mockRejectedValue(new Error('Stat failed'))
      const result = await sftp.copy(
        'sftp_test_session',
        {
          name: 'src',
          type: 'directory',
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

    it('should handle copy directory mkdir target error', async () => {
      setupSession()
      mockClient.stat.mockResolvedValue({ isDirectory: true })
      mockClient.mkdir.mockRejectedValue(new Error('Cannot create target directory'))
      const result = await sftp.copy(
        'sftp_test_session',
        {
          name: 'srcdir',
          type: 'directory',
          size: 0,
          modifyTime: 0,
          permissions: '',
          owner: '',
          absolutePath: '/srcdir',
        },
        '/dstdir'
      )
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('COPY_ERROR')
    })
  })

  describe('move error handling', () => {
    it('should handle move rename error', async () => {
      setupSession()
      mockClient.stat.mockRejectedValue(new Error('No such file'))
      mockClient.rename.mockRejectedValue(new Error('Move failed'))
      const result = await sftp.move(
        'sftp_test_session',
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
      mockClient.stat.mockRejectedValue(new Error('Connection lost'))
      const result = await sftp.ping('sftp_test_session')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('PING_ERROR')
    })
  })
})
