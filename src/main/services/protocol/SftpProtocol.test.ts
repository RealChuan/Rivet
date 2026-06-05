import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROTOCOL, SftpStatus } from '@shared/constants/index.js'
import { type ConnectionConfig } from '@shared/types/index.js'
import { SftpProtocol } from './SftpProtocol.js'

// 使用 vi.hoisted 确保 mock 对象在 vi.mock 提升前可用
const { mockClient, mockSessionRegistry, mockSftpConstructor } = vi.hoisted(() => {
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
    fastPut: vi.fn(),
  }
  const mockSftpConstructor = vi.fn().mockImplementation(function () {
    return mockClient
  })
  const mockSessionRegistry = {
    register: vi.fn(),
    unregister: vi.fn(),
    get: vi.fn().mockReturnValue(null),
    setClosing: vi.fn(),
  }
  return { mockClient, mockSessionRegistry, mockSftpConstructor }
})

vi.mock('ssh2-sftp-client', () => {
  return {
    default: mockSftpConstructor,
  }
})

vi.mock('../session-registry', () => ({
  sessionRegistry: mockSessionRegistry,
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

vi.mock('node:fs', () => ({
  default: {
    promises: {
      stat: vi.fn().mockResolvedValue({ size: 1024 }),
    },
  },
}))

// exactOptionalPropertyTypes: true 下不能写 password: undefined，省略即可
const baseConfig: ConnectionConfig = {
  id: 'test-conn-id',
  name: 'Test SFTP',
  protocol: PROTOCOL.SFTP,
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
    mockClient.fastPut.mockResolvedValue(undefined)
  })

  /** 注册一个模拟会话，使公共方法（list/mkdir/...）可通过 sessionId 获取 mockClient */
  function setupSession() {
    mockSessionRegistry.get.mockReturnValue({
      client: mockClient,
      config: baseConfig,
      protocolType: PROTOCOL.SFTP,
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
      const hostVerifier = vi.fn().mockReturnValue({
        detail: { hash: 'new-hash', previousHash: 'old-hash' },
        status: SftpStatus.HOST_KEY_MISMATCH,
      })
      mockClient.connect.mockImplementation((options: Record<string, unknown>) => {
        const verifier = options.hostVerifier as ((hash: string) => boolean) | undefined
        if (verifier) {
          verifier('new-hash')
        }
        throw new Error('Host key verification failed')
      })

      const result = await sftp.connect(baseConfig, 'testpass', hostVerifier)
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.value.statusCode).toBe(SftpStatus.HOST_KEY_MISMATCH)
      expect(hostVerifier).toHaveBeenCalledWith('new-hash')
    })

    it('should return FIRST_CONNECT when hostVerifier reports first connection', async () => {
      const { ProtocolStatus } = await import('@shared/constants/index.js')
      const hostVerifier = vi.fn().mockReturnValue({
        detail: { hash: 'new-hash' },
        status: ProtocolStatus.FIRST_CONNECT,
      })
      mockClient.connect.mockImplementation((options: Record<string, unknown>) => {
        const verifier = options.hostVerifier as ((hash: string) => boolean) | undefined
        if (verifier) {
          verifier('new-hash')
        }
        return Promise.resolve(undefined)
      })

      const result = await sftp.connect(baseConfig, 'testpass', hostVerifier)
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.value.statusCode).toBe(ProtocolStatus.FIRST_CONNECT)
    })

    it('should return OK when hostVerifier confirms matching key', async () => {
      const { ProtocolStatus } = await import('@shared/constants/index.js')
      const hostVerifier = vi.fn().mockReturnValue({
        detail: { hash: 'known-hash' },
        status: ProtocolStatus.OK,
      })
      mockClient.connect.mockImplementation((options: Record<string, unknown>) => {
        const verifier = options.hostVerifier as ((hash: string) => boolean) | undefined
        if (verifier) {
          verifier('known-hash')
        }
        return Promise.resolve(undefined)
      })

      const result = await sftp.connect(baseConfig, 'testpass', hostVerifier)
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.value.statusCode).toBe(ProtocolStatus.OK)
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
      expect(mockSessionRegistry.unregister).toHaveBeenCalledWith('sftp_test_session')
    })

    it('should handle disconnect when session not found', async () => {
      mockSessionRegistry.get.mockReturnValue(null)
      const result = await sftp.disconnect('nonexistent')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('SESSION_NOT_FOUND')
    })

    it('should handle client.end() error gracefully', async () => {
      setupSession()
      mockClient.end.mockRejectedValue(new Error('Connection already closed'))

      const result = await sftp.disconnect('sftp_test_session')
      expect(mockSessionRegistry.unregister).toHaveBeenCalledWith('sftp_test_session')
      expect(result.success).toBe(true)
    })

    it('should always unregister session even on error', async () => {
      setupSession()
      mockClient.end.mockRejectedValue(new Error('Force close error'))

      await sftp.disconnect('sftp_test_session')
      expect(mockSessionRegistry.unregister).toHaveBeenCalledWith('sftp_test_session')
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
      mockClient.delete.mockRejectedValue(new Error('No such file'))
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

    it('should call rmdir for directory type and delete for file type', async () => {
      setupSession()

      await sftp.delete('sftp_test_session', {
        name: 'dir',
        type: 'directory',
        size: 0,
        modifyTime: 0,
        permissions: '',
        owner: '',
        absolutePath: '/dir',
      })
      expect(mockClient.rmdir).toHaveBeenCalledWith('/dir', true)
      expect(mockClient.delete).not.toHaveBeenCalled()

      mockClient.rmdir.mockClear()

      await sftp.delete('sftp_test_session', {
        name: 'file',
        type: 'file',
        size: 0,
        modifyTime: 0,
        permissions: '',
        owner: '',
        absolutePath: '/file',
      })
      expect(mockClient.delete).toHaveBeenCalledWith('/file')
      expect(mockClient.rmdir).not.toHaveBeenCalled()
    })

    it('should not call stat for delete operations', async () => {
      setupSession()

      await sftp.delete('sftp_test_session', {
        name: 'file',
        type: 'file',
        size: 0,
        modifyTime: 0,
        permissions: '',
        owner: '',
        absolutePath: '/file',
      })
      expect(mockClient.stat).not.toHaveBeenCalled()
    })
  })

  describe('copy error handling', () => {
    it('should handle copy file error', async () => {
      setupSession()
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

    it('should handle copy directory mkdir target error', async () => {
      setupSession()
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

    it('should call copyDirectory for directory type and rcopy for file type', async () => {
      setupSession()

      await sftp.copy(
        'sftp_test_session',
        {
          name: 'file',
          type: 'file',
          size: 0,
          modifyTime: 0,
          permissions: '',
          owner: '',
          absolutePath: '/file',
        },
        '/dst'
      )
      expect(mockClient.rcopy).toHaveBeenCalledWith('/file', '/dst')

      mockClient.rcopy.mockClear()

      await sftp.copy(
        'sftp_test_session',
        {
          name: 'dir',
          type: 'directory',
          size: 0,
          modifyTime: 0,
          permissions: '',
          owner: '',
          absolutePath: '/dir',
        },
        '/dstdir'
      )
      expect(mockClient.rcopy).not.toHaveBeenCalled()
      expect(mockClient.mkdir).toHaveBeenCalled()
    })

    it('should not call stat for copy operations', async () => {
      setupSession()

      await sftp.copy(
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
      expect(mockClient.stat).not.toHaveBeenCalled()
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

  describe('upload', () => {
    it('should upload file successfully', async () => {
      setupSession()
      const onProgress = vi.fn()
      const result = await sftp.upload(
        'sftp_test_session',
        '/local/file.txt',
        '/remote/file.txt',
        onProgress
      )
      expect(result.success).toBe(true)
      expect(mockClient.fastPut).toHaveBeenCalledWith(
        '/local/file.txt',
        '/remote/file.txt',
        expect.objectContaining({
          chunkSize: expect.any(Number) as number,
          step: expect.any(Function) as unknown as ((total: number) => void) | undefined,
        })
      )
    })

    it('should handle upload failure', async () => {
      setupSession()
      mockClient.fastPut.mockRejectedValue(new Error('Permission denied'))
      const onProgress = vi.fn()
      const result = await sftp.upload(
        'sftp_test_session',
        '/local/file.txt',
        '/remote/file.txt',
        onProgress
      )
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('UPLOAD_ERROR')
    })

    it('should call onProgress with step values', async () => {
      setupSession()
      const onProgress = vi.fn()
      mockClient.fastPut.mockImplementation(
        (_local: string, _remote: string, options: Record<string, unknown>) => {
          const step = options.step as ((total: number) => void) | undefined
          step?.(1024)
          step?.(2048)
          return Promise.resolve(undefined)
        }
      )
      const result = await sftp.upload(
        'sftp_test_session',
        '/local/file.txt',
        '/remote/file.txt',
        onProgress
      )
      expect(result.success).toBe(true)
      expect(onProgress).toHaveBeenCalledWith(1024)
      expect(onProgress).toHaveBeenCalledWith(2048)
    })

    it('should return UPLOAD_ABORTED when signal is already aborted', async () => {
      setupSession()
      const controller = new AbortController()
      controller.abort()
      const onProgress = vi.fn()
      const result = await sftp.upload(
        'sftp_test_session',
        '/local/file.txt',
        '/remote/file.txt',
        onProgress,
        controller.signal
      )
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('UPLOAD_ABORTED')
    })

    it('should delete remote file when upload completes but signal was aborted', async () => {
      setupSession()
      const controller = new AbortController()
      const onProgress = vi.fn()

      // fastPut 完成后检测到 abort，应删除远程文件
      mockClient.fastPut.mockImplementation(() => {
        controller.abort()
        return Promise.resolve(undefined)
      })

      const result = await sftp.upload(
        'sftp_test_session',
        '/local/file.txt',
        '/remote/file.txt',
        onProgress,
        controller.signal
      )
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('UPLOAD_ABORTED')
      expect(mockClient.delete).toHaveBeenCalledWith('/remote/file.txt')
    })

    it('should not report progress after signal is aborted', async () => {
      setupSession()
      const controller = new AbortController()
      const onProgress = vi.fn()

      mockClient.fastPut.mockImplementation(
        (_local: string, _remote: string, options: Record<string, unknown>) => {
          const step = options.step as ((total: number) => void) | undefined
          step?.(1024)
          controller.abort()
          step?.(2048)
          return Promise.resolve(undefined)
        }
      )

      const result = await sftp.upload(
        'sftp_test_session',
        '/local/file.txt',
        '/remote/file.txt',
        onProgress,
        controller.signal
      )
      expect(result.success).toBe(false)
      // 只有 abort 前的进度被报告
      expect(onProgress).toHaveBeenCalledTimes(1)
      expect(onProgress).toHaveBeenCalledWith(1024)
    })
  })
})
