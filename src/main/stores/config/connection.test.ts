import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROTOCOL, STORE_KEY } from '@shared/constants/index.js'
import { getConnectionConfigs, removeConnectionConfig, saveConnectionConfig } from './connection.js'
import { getFromMemory, setToMemory } from './store.js'
import { isValidConnection } from './validation.js'

vi.mock('./store.js', () => ({
  getFromMemory: vi.fn(),
  setToMemory: vi.fn(),
}))

vi.mock('./validation.js', () => ({
  isValidConnection: vi.fn(),
}))

vi.mock('../../utils/index.js', () => ({
  logger: {
    catch: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('connection config utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getConnectionConfigs', () => {
    it('should return saved connections', () => {
      const mockConnections = [
        {
          id: 'conn1',
          name: 'Connection 1',
          protocol: PROTOCOL.SFTP,
          host: 'localhost',
          port: 22,
          username: 'user',
          savePassword: false,
        },
        {
          id: 'conn2',
          name: 'Connection 2',
          protocol: PROTOCOL.WEBDAV,
          host: 'localhost',
          port: 80,
          username: 'user',
          savePassword: false,
        },
      ]
      vi.mocked(getFromMemory).mockReturnValue(mockConnections)

      const result = getConnectionConfigs()

      expect(getFromMemory).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS)
      expect(result.success).toBe(true)
      expect(result.value).toEqual(mockConnections)
    })

    it('should return error when getting connections fails', () => {
      const testError = new Error('Failed to get connections')
      vi.mocked(getFromMemory).mockImplementation(() => {
        throw testError
      })

      const result = getConnectionConfigs()

      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('CONFIG_ERROR')
      expect(result.error?.message).toBe('Failed to get saved connections')
    })
  })

  describe('saveConnectionConfig', () => {
    it('should save valid new connection', () => {
      const mockConnections: [] = []
      const newConnection = {
        id: 'new-conn',
        name: 'New Connection',
        protocol: PROTOCOL.SFTP,
        host: 'localhost',
        port: 22,
        username: 'user',
        savePassword: false,
      }
      vi.mocked(getFromMemory).mockReturnValue(mockConnections)
      vi.mocked(isValidConnection).mockReturnValue(true)

      const result = saveConnectionConfig(newConnection)

      expect(isValidConnection).toHaveBeenCalledWith(newConnection)
      expect(getFromMemory).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS)
      expect(setToMemory).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS, [newConnection])
      expect(result.success).toBe(true)
    })

    it('should update existing connection', () => {
      const existingConnection = {
        id: 'conn1',
        name: 'Old Name',
        protocol: PROTOCOL.SFTP,
        host: 'localhost',
        port: 22,
        username: 'user',
        savePassword: false,
      }
      const updatedConnection = {
        ...existingConnection,
        name: 'Updated Name',
      }
      vi.mocked(getFromMemory).mockReturnValue([existingConnection])
      vi.mocked(isValidConnection).mockReturnValue(true)

      const result = saveConnectionConfig(updatedConnection)

      expect(setToMemory).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS, [updatedConnection])
      expect(result.success).toBe(true)
    })

    it('should not save password when savePassword is false', () => {
      const connectionWithPassword = {
        id: 'conn1',
        name: 'Test',
        protocol: PROTOCOL.SFTP,
        host: 'localhost',
        port: 22,
        username: 'user',
        savePassword: false,
        password: 'secret',
      }
      vi.mocked(getFromMemory).mockReturnValue([])
      vi.mocked(isValidConnection).mockReturnValue(true)

      saveConnectionConfig(connectionWithPassword)

      const mockSetToMemory = vi.mocked(setToMemory)
      expect(mockSetToMemory).toHaveBeenCalled()
      const savedArg = mockSetToMemory.mock.calls[0]?.[1]
      expect(savedArg).toBeDefined()
    })

    it('should return error for invalid connection', () => {
      const invalidConnection = { id: 'test', name: 'Test' }
      vi.mocked(isValidConnection).mockReturnValue(false)

      const result = saveConnectionConfig(invalidConnection as never)

      expect(isValidConnection).toHaveBeenCalled()
      expect(setToMemory).not.toHaveBeenCalled()
      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toBe('Invalid connection configuration')
    })

    it('should return error when save fails', () => {
      const connection = {
        id: 'conn1',
        name: 'Test',
        protocol: PROTOCOL.SFTP,
        host: 'localhost',
        port: 22,
        username: 'user',
        savePassword: false,
      }
      vi.mocked(isValidConnection).mockReturnValue(true)
      vi.mocked(getFromMemory).mockImplementation(() => {
        throw new Error('Save error')
      })

      const result = saveConnectionConfig(connection)

      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('CONFIG_ERROR')
    })
  })

  describe('removeConnectionConfig', () => {
    it('should remove existing connection', () => {
      const connections = [
        {
          id: 'conn1',
          name: 'Connection 1',
          protocol: PROTOCOL.SFTP,
          host: 'localhost',
          port: 22,
          username: 'user',
          savePassword: false,
        },
        {
          id: 'conn2',
          name: 'Connection 2',
          protocol: PROTOCOL.SFTP,
          host: 'localhost',
          port: 22,
          username: 'user',
          savePassword: false,
        },
      ]
      vi.mocked(getFromMemory).mockReturnValue(connections)

      const result = removeConnectionConfig('conn1')

      expect(getFromMemory).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS)
      expect(setToMemory).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS, [
        {
          id: 'conn2',
          name: 'Connection 2',
          protocol: PROTOCOL.SFTP,
          host: 'localhost',
          port: 22,
          username: 'user',
          savePassword: false,
        },
      ])
      expect(result.success).toBe(true)
    })

    it('should handle removing non-existent connection', () => {
      const connections = [
        {
          id: 'conn1',
          name: 'Connection 1',
          protocol: PROTOCOL.SFTP,
          host: 'localhost',
          port: 22,
          username: 'user',
          savePassword: false,
        },
      ]
      vi.mocked(getFromMemory).mockReturnValue(connections)

      const result = removeConnectionConfig('nonexistent')

      expect(setToMemory).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS, connections)
      expect(result.success).toBe(true)
    })

    it('should return error when remove fails', () => {
      vi.mocked(getFromMemory).mockImplementation(() => {
        throw new Error('Remove error')
      })

      const result = removeConnectionConfig('conn1')

      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('CONFIG_ERROR')
    })
  })
})
