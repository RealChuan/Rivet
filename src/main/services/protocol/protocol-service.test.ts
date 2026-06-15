import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileInfo, OperationResult } from '@shared/types/index.js'
import { ERROR_CODE, SftpStatus } from '@shared/constants/index.js'
import { createErrorInfo, err, type ErrorInfo, ok, type Result } from '@shared/types/result.js'

// --- Mock protocol instance methods ---
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockList = vi.fn()
const mockMkdir = vi.fn()
const mockRename = vi.fn()
const mockDelete = vi.fn()
const mockCopy = vi.fn()
const mockMove = vi.fn()
const mockPing = vi.fn()

const mockProtocolInstance = {
  connect: mockConnect,
  disconnect: mockDisconnect,
  list: mockList,
  mkdir: mockMkdir,
  rename: mockRename,
  delete: mockDelete,
  copy: mockCopy,
  move: mockMove,
  ping: mockPing,
  protocolType: 'sftp' as const,
}

// Must use regular function (not arrow) so `new` works
vi.mock('./SftpProtocol.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.fn constructor mock requires any
  SftpProtocol: vi.fn(function (this: any) {
    Object.assign(this, mockProtocolInstance)
  }),
}))

vi.mock('./WebdavProtocol.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.fn constructor mock requires any
  WebdavProtocol: vi.fn(function (this: any) {
    Object.assign(this, mockProtocolInstance)
  }),
}))

const mockSessionGet = vi.fn()
vi.mock('../session-registry.js', () => ({
  sessionRegistry: { get: mockSessionGet },
}))

const mockDecryptPassword = vi.fn()
vi.mock('../../utils/index.js', () => ({
  logger: { info: vi.fn(), catch: vi.fn() },
  decryptPassword: mockDecryptPassword,
}))

const mockGetHostKeyRecord = vi.fn()
vi.mock('../../stores/index.js', () => ({
  getHostKeyRecord: mockGetHostKeyRecord,
}))

let uuidCounter = 0
vi.mock('node:crypto', () => ({
  default: {
    randomUUID: () => `test-uuid-${++uuidCounter}`,
  },
}))

// Import after mocks
const { ProtocolService } = await import('./protocol-service.js')

describe('ProtocolService', () => {
  let service: InstanceType<typeof ProtocolService>

  beforeEach(() => {
    service = new ProtocolService()
    uuidCounter = 0
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Helper: create a mock that listens for abort signal and rejects with AbortError
  function createAbortAwareMock<T>() {
    return vi.fn((_sid: string, _path: string, signal?: AbortSignal) => {
      return new Promise<Result<T, ErrorInfo>>((_resolve, reject) => {
        const abortError = new Error('The operation was aborted')
        abortError.name = 'AbortError'
        if (signal?.aborted) {
          reject(abortError)
          return
        }
        signal?.addEventListener('abort', () => {
          reject(abortError)
        })
      })
    })
  }

  // --- cancel ---
  describe('cancel', () => {
    it('existing requestId aborts and deletes', async () => {
      mockSessionGet.mockReturnValue({ protocolType: 'sftp', client: {}, config: {} })
      mockList.mockImplementation(createAbortAwareMock<FileInfo[]>())

      // Start a list request (don't await) to register an activeRequest
      const listPromise = service.list('session-1', '/path')

      // Cancel the request created by list (requestId = test-uuid-1)
      service.cancel('test-uuid-1')

      const result = await listPromise
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('REQUEST_ABORTED')
    })

    it('non-existing requestId does nothing', () => {
      // Should not throw
      service.cancel('non-existing-id')
    })
  })

  // --- connect ---
  describe('connect', () => {
    const baseConfig = {
      id: 'conn-1',
      name: 'Test Connection',
      protocol: 'sftp' as const,
      host: 'localhost',
      port: 22,
      username: 'user',
      password: 'encrypted-password',
    }

    it('successful connection with decrypted password', async () => {
      mockDecryptPassword.mockReturnValue(ok('decrypted-pwd'))
      mockGetHostKeyRecord.mockReturnValue(ok(undefined))
      const operationResult: OperationResult = {
        sessionId: 'session-1',
        statusCode: 2000,
        detail: { hash: 'abc123' },
      }
      mockConnect.mockResolvedValue(ok(operationResult))

      const result = await service.connect(baseConfig)

      expect(result.success).toBe(true)
      expect(result.value?.sessionId).toBe('session-1')
      expect(mockConnect).toHaveBeenCalledWith(baseConfig, 'decrypted-pwd', expect.any(Function))
    })

    it('password decryption fails returns AUTH_ERROR', async () => {
      mockDecryptPassword.mockReturnValue(err(createErrorInfo('DECRYPTION_ERROR', 'Failed')))

      const result = await service.connect(baseConfig)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('AUTH_ERROR')
    })

    it('no password returns AUTH_ERROR', async () => {
      const { password: _, ...configNoPassword } = baseConfig
      const result = await service.connect(configNoPassword)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('AUTH_ERROR')
    })

    it('protocol connect fails returns CONN_FAILED', async () => {
      mockDecryptPassword.mockReturnValue(ok('decrypted-pwd'))
      mockGetHostKeyRecord.mockReturnValue(ok(undefined))
      mockConnect.mockResolvedValue(
        err(createErrorInfo(ERROR_CODE.CONN_FAILED, 'Connection refused'))
      )

      const result = await service.connect(baseConfig)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('CONN_FAILED')
    })

    it('HOST_KEY_MISMATCH returns success with statusCode', async () => {
      mockDecryptPassword.mockReturnValue(ok('decrypted-pwd'))
      mockGetHostKeyRecord.mockReturnValue(
        ok({ connectionId: 'conn-1', hash: 'old-hash', createdAt: Date.now() })
      )
      const operationResult: OperationResult = {
        sessionId: '',
        statusCode: SftpStatus.HOST_KEY_MISMATCH,
        detail: { hash: 'abc123', previousHash: 'old-hash' },
      }
      mockConnect.mockResolvedValue(ok(operationResult))

      const result = await service.connect(baseConfig)

      expect(result.success).toBe(true)
      expect(result.value?.statusCode).toBe(SftpStatus.HOST_KEY_MISMATCH)
    })

    it('no sessionId returned returns CONN_FAILED', async () => {
      mockDecryptPassword.mockReturnValue(ok('decrypted-pwd'))
      mockGetHostKeyRecord.mockReturnValue(ok(undefined))
      const operationResult: OperationResult = {
        sessionId: '',
        statusCode: 2000,
        detail: { hash: 'abc123' },
      }
      mockConnect.mockResolvedValue(ok(operationResult))

      const result = await service.connect(baseConfig)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('CONN_FAILED')
    })

    it('exception caught returns CONN_FAILED', async () => {
      mockDecryptPassword.mockReturnValue(ok('decrypted-pwd'))
      mockGetHostKeyRecord.mockReturnValue(ok(undefined))
      mockConnect.mockRejectedValue(new Error('Network error'))

      const result = await service.connect(baseConfig)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('CONN_FAILED')
    })

    it('constructs hostVerifier callback for SFTP protocol', async () => {
      mockDecryptPassword.mockReturnValue(ok('decrypted-pwd'))
      mockGetHostKeyRecord.mockReturnValue(
        ok({ connectionId: 'conn-1', hash: 'known-hash', createdAt: Date.now() })
      )
      const operationResult: OperationResult = {
        sessionId: 'session-1',
        statusCode: 2000,
        detail: { hash: 'abc123' },
      }
      mockConnect.mockResolvedValue(ok(operationResult))

      await service.connect(baseConfig)

      expect(mockConnect).toHaveBeenCalledWith(baseConfig, 'decrypted-pwd', expect.any(Function))
      const callArgs = mockConnect.mock.calls[0]
      if (!callArgs) return
      const hostVerifier = callArgs[2] as (hashedKey: string) => {
        detail: unknown
        status: number
      }

      const result = hostVerifier('known-hash')
      expect(result.status).toBe(2000)
    })

    it('hostVerifier returns FIRST_CONNECT when no host key record', async () => {
      const { ProtocolStatus } = await import('@shared/constants/index.js')
      mockDecryptPassword.mockReturnValue(ok('decrypted-pwd'))
      mockGetHostKeyRecord.mockReturnValue(ok(undefined))
      const operationResult: OperationResult = {
        sessionId: 'session-1',
        statusCode: 2000,
        detail: { hash: 'abc123' },
      }
      mockConnect.mockResolvedValue(ok(operationResult))

      await service.connect(baseConfig)

      const callArgs = mockConnect.mock.calls[0]
      if (!callArgs) return
      const hostVerifier = callArgs[2] as (hashedKey: string) => {
        detail: unknown
        status: number
      }
      const result = hostVerifier('new-hash')
      expect(result.status).toBe(ProtocolStatus.FIRST_CONNECT)
    })

    it('hostVerifier returns HOST_KEY_MISMATCH when hash differs', async () => {
      mockDecryptPassword.mockReturnValue(ok('decrypted-pwd'))
      mockGetHostKeyRecord.mockReturnValue(
        ok({ connectionId: 'conn-1', hash: 'old-hash', createdAt: Date.now() })
      )
      const operationResult: OperationResult = {
        sessionId: 'session-1',
        statusCode: 2000,
        detail: { hash: 'abc123' },
      }
      mockConnect.mockResolvedValue(ok(operationResult))

      await service.connect(baseConfig)

      const callArgs = mockConnect.mock.calls[0]
      if (!callArgs) return
      const hostVerifier = callArgs[2] as (hashedKey: string) => {
        detail: unknown
        status: number
      }
      const result = hostVerifier('different-hash')
      expect(result.status).toBe(SftpStatus.HOST_KEY_MISMATCH)
    })

    it('does not pass hostVerifier for WebDAV protocol', async () => {
      mockDecryptPassword.mockReturnValue(ok('decrypted-pwd'))
      const webdavConfig = { ...baseConfig, protocol: 'webdav' as const }
      const operationResult: OperationResult = {
        sessionId: 'session-1',
        statusCode: 2000,
        detail: { hash: '' },
      }
      mockConnect.mockResolvedValue(ok(operationResult))

      await service.connect(webdavConfig)

      expect(mockConnect).toHaveBeenCalledWith(webdavConfig, 'decrypted-pwd', undefined)
    })
  })

  // --- disconnect ---
  describe('disconnect', () => {
    it('successful disconnect', async () => {
      mockSessionGet.mockReturnValue({ protocolType: 'sftp', client: {}, config: {} })
      mockDisconnect.mockResolvedValue(ok(undefined))

      const result = await service.disconnect('session-1')

      expect(result.success).toBe(true)
      expect(mockDisconnect).toHaveBeenCalledWith('session-1')
    })

    it('session not found returns CONN_NOT_FOUND', async () => {
      mockSessionGet.mockReturnValue(undefined)

      const result = await service.disconnect('session-1')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('CONN_NOT_FOUND')
    })
  })

  // --- list ---
  describe('list', () => {
    it('successful list returns files', async () => {
      mockSessionGet.mockReturnValue({ protocolType: 'sftp', client: {}, config: {} })
      const files: FileInfo[] = [
        { name: 'file.txt', type: 'file', size: 100, modifyTime: 0, absolutePath: '/file.txt' },
      ]
      mockList.mockResolvedValue(ok(files))

      const result = await service.list('session-1', '/path')

      expect(result.success).toBe(true)
      expect(result.value).toEqual(files)
    })

    it('session not found returns error', async () => {
      mockSessionGet.mockReturnValue(undefined)

      const result = await service.list('session-1', '/path')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('CONN_NOT_FOUND')
    })

    it('passes signal to protocol implementation', async () => {
      mockSessionGet.mockReturnValue({ protocolType: 'sftp', client: {}, config: {} })
      mockList.mockImplementation((_sid: string, _path: string, signal?: AbortSignal) => {
        expect(signal).toBeInstanceOf(AbortSignal)
        return Promise.resolve(ok([]))
      })

      await service.list('session-1', '/path')
    })
  })

  // --- mkdir ---
  describe('mkdir', () => {
    it('successful mkdir', async () => {
      mockSessionGet.mockReturnValue({ protocolType: 'sftp', client: {}, config: {} })
      mockMkdir.mockResolvedValue(ok(undefined))

      const result = await service.mkdir('session-1', '/new-dir')

      expect(result.success).toBe(true)
      expect(mockMkdir).toHaveBeenCalledWith('session-1', '/new-dir', expect.any(AbortSignal))
    })
  })

  // --- rename ---
  describe('rename', () => {
    it('successful rename', async () => {
      mockSessionGet.mockReturnValue({ protocolType: 'sftp', client: {}, config: {} })
      mockRename.mockResolvedValue(ok(undefined))
      const file: FileInfo = {
        name: 'old.txt',
        type: 'file',
        size: 100,
        modifyTime: 0,
        absolutePath: '/old.txt',
      }

      const result = await service.rename('session-1', file, 'new.txt')

      expect(result.success).toBe(true)
      expect(mockRename).toHaveBeenCalledWith('session-1', file, 'new.txt', expect.any(AbortSignal))
    })
  })

  // --- delete ---
  describe('delete', () => {
    it('successful delete', async () => {
      mockSessionGet.mockReturnValue({ protocolType: 'sftp', client: {}, config: {} })
      mockDelete.mockResolvedValue(ok(undefined))
      const file: FileInfo = {
        name: 'file.txt',
        type: 'file',
        size: 100,
        modifyTime: 0,
        absolutePath: '/file.txt',
      }

      const result = await service.delete('session-1', file)

      expect(result.success).toBe(true)
      expect(mockDelete).toHaveBeenCalledWith('session-1', file, expect.any(AbortSignal))
    })
  })

  // --- copy ---
  describe('copy', () => {
    it('successful copy', async () => {
      mockSessionGet.mockReturnValue({ protocolType: 'sftp', client: {}, config: {} })
      mockCopy.mockResolvedValue(ok(undefined))
      const file: FileInfo = {
        name: 'file.txt',
        type: 'file',
        size: 100,
        modifyTime: 0,
        absolutePath: '/file.txt',
      }

      const result = await service.copy('session-1', file, '/target')

      expect(result.success).toBe(true)
      expect(mockCopy).toHaveBeenCalledWith('session-1', file, '/target', expect.any(AbortSignal))
    })
  })

  // --- move ---
  describe('move', () => {
    it('successful move', async () => {
      mockSessionGet.mockReturnValue({ protocolType: 'sftp', client: {}, config: {} })
      mockMove.mockResolvedValue(ok(undefined))
      const file: FileInfo = {
        name: 'file.txt',
        type: 'file',
        size: 100,
        modifyTime: 0,
        absolutePath: '/file.txt',
      }

      const result = await service.move('session-1', file, '/target')

      expect(result.success).toBe(true)
      expect(mockMove).toHaveBeenCalledWith('session-1', file, '/target', expect.any(AbortSignal))
    })
  })

  // --- ping ---
  describe('ping', () => {
    it('successful ping', async () => {
      mockSessionGet.mockReturnValue({ protocolType: 'sftp', client: {}, config: {} })
      mockPing.mockResolvedValue(ok(undefined))

      const result = await service.ping('session-1')

      expect(result.success).toBe(true)
    })

    it('session not found returns error', async () => {
      mockSessionGet.mockReturnValue(undefined)

      const result = await service.ping('session-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error?.code).toBe('CONN_NOT_FOUND')
      }
    })
  })

  // --- executeWithRequest timeout ---
  describe('executeWithRequest timeout', () => {
    it('returns REQUEST_ABORTED on timeout', async () => {
      vi.useFakeTimers()
      mockSessionGet.mockReturnValue({ protocolType: 'sftp', client: {}, config: {} })

      // Make list hang until abort signal fires
      mockList.mockImplementation(createAbortAwareMock<FileInfo[]>())

      const listPromise = service.list('session-1', '/path')

      // Advance past the LIST timeout (60000ms) which triggers controller.abort()
      await vi.advanceTimersByTimeAsync(60001)

      const result = await listPromise
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('REQUEST_ABORTED')
    })
  })

  // --- executeWithRequest custom requestId ---
  describe('executeWithRequest custom requestId', () => {
    it('uses provided requestId', async () => {
      mockSessionGet.mockReturnValue({ protocolType: 'sftp', client: {}, config: {} })
      mockDisconnect.mockResolvedValue(ok(undefined))

      const result = await service.disconnect('session-1', 'my-custom-id')

      expect(result.requestId).toBe('my-custom-id')
    })
  })

  // --- getProtocol lazy init ---
  describe('getProtocol lazy init', () => {
    it('creates and caches protocol instance', async () => {
      const { SftpProtocol } = await import('./SftpProtocol.js')

      mockSessionGet.mockReturnValue({ protocolType: 'sftp', client: {}, config: {} })
      mockDisconnect.mockResolvedValue(ok(undefined))

      // First call should create instance
      await service.disconnect('session-1')
      expect(SftpProtocol).toHaveBeenCalledTimes(1)

      // Second call should reuse cached instance
      await service.disconnect('session-2')
      expect(SftpProtocol).toHaveBeenCalledTimes(1)
    })
  })
})
