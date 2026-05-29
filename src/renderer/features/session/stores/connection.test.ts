import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SORT_ORDER, STORE_KEY } from '@shared/constants/index.js'
import { type ConnectionConfig, err, ok } from '@shared/types/index.js'
import { useConnectionStore } from './connection.js'

const mockConfigGet = vi.fn()
const mockConfigSet = vi.fn()
const mockHostKeyDelete = vi.fn()

vi.stubGlobal('window', {
  electronAPI: {
    config: {
      get: mockConfigGet,
      set: mockConfigSet,
    },
    hostKey: {
      delete: mockHostKeyDelete,
    },
  },
})

function createConnection(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: 'conn-1',
    name: 'Test Connection',
    protocol: 'sftp',
    host: 'example.com',
    port: 22,
    username: 'user',
    ...overrides,
  }
}

describe('useConnectionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store to initial state
    useConnectionStore.setState({
      connections: [],
      pendingConnectionConfig: null,
      pendingIsEditing: false,
      closeConnectionDialog: false,
      sortOrder: SORT_ORDER.NONE,
    })
    // Default mock implementations
    mockConfigGet.mockResolvedValue({ success: true, value: [] })
    mockConfigSet.mockResolvedValue({ success: true })
    mockHostKeyDelete.mockResolvedValue({ success: true })
  })

  describe('initial state', () => {
    it('should have empty connections array', () => {
      expect(useConnectionStore.getState().connections).toEqual([])
    })

    it('should have null pendingConnectionConfig', () => {
      expect(useConnectionStore.getState().pendingConnectionConfig).toBeNull()
    })

    it('should have false pendingIsEditing', () => {
      expect(useConnectionStore.getState().pendingIsEditing).toBe(false)
    })

    it('should have false closeConnectionDialog', () => {
      expect(useConnectionStore.getState().closeConnectionDialog).toBe(false)
    })

    it('should have sortOrder as none', () => {
      expect(useConnectionStore.getState().sortOrder).toBe(SORT_ORDER.NONE)
    })
  })

  describe('addConnection', () => {
    it('should add a connection to the connections array', () => {
      const config = createConnection()
      const id = useConnectionStore.getState().addConnection(config)

      expect(id).toBe('conn-1')
      expect(useConnectionStore.getState().connections).toHaveLength(1)
      expect(useConnectionStore.getState().connections[0]).toEqual(config)
    })

    it('should return the connection id', () => {
      const config = createConnection({ id: 'my-unique-id' })
      const id = useConnectionStore.getState().addConnection(config)

      expect(id).toBe('my-unique-id')
    })

    it('should add multiple connections', () => {
      const config1 = createConnection({ id: 'conn-1', name: 'First' })
      const config2 = createConnection({ id: 'conn-2', name: 'Second' })

      useConnectionStore.getState().addConnection(config1)
      useConnectionStore.getState().addConnection(config2)

      expect(useConnectionStore.getState().connections).toHaveLength(2)
      const conn0 = useConnectionStore.getState().connections[0]
      const conn1 = useConnectionStore.getState().connections[1]
      if (!conn0) throw new Error('Expected connection at index 0')
      if (!conn1) throw new Error('Expected connection at index 1')
      expect(conn0.name).toBe('First')
      expect(conn1.name).toBe('Second')
    })
  })

  describe('updateConnection', () => {
    it('should update an existing connection by id', () => {
      const config = createConnection({ id: 'conn-1', name: 'Original' })
      useConnectionStore.getState().addConnection(config)

      const updated = createConnection({ id: 'conn-1', name: 'Updated', host: 'new-host.com' })
      useConnectionStore.getState().updateConnection(updated)

      expect(useConnectionStore.getState().connections).toHaveLength(1)
      const conn = useConnectionStore.getState().connections[0]
      if (!conn) throw new Error('Expected connection')
      expect(conn.name).toBe('Updated')
      expect(conn.host).toBe('new-host.com')
    })

    it('should not affect other connections when updating', () => {
      const config1 = createConnection({ id: 'conn-1', name: 'First' })
      const config2 = createConnection({ id: 'conn-2', name: 'Second' })
      useConnectionStore.getState().addConnection(config1)
      useConnectionStore.getState().addConnection(config2)

      const updated = createConnection({ id: 'conn-1', name: 'Updated First' })
      useConnectionStore.getState().updateConnection(updated)

      const { connections } = useConnectionStore.getState()
      expect(connections).toHaveLength(2)
      expect(connections.find(c => c.id === 'conn-1')?.name).toBe('Updated First')
      expect(connections.find(c => c.id === 'conn-2')?.name).toBe('Second')
    })

    it('should not add a new connection if id does not match', () => {
      const config = createConnection({ id: 'conn-1' })
      useConnectionStore.getState().addConnection(config)

      const nonExistent = createConnection({ id: 'conn-999', name: 'Ghost' })
      useConnectionStore.getState().updateConnection(nonExistent)

      expect(useConnectionStore.getState().connections).toHaveLength(1)
      const conn = useConnectionStore.getState().connections[0]
      if (!conn) throw new Error('Expected connection')
      expect(conn.id).toBe('conn-1')
    })
  })

  describe('deleteConnection', () => {
    it('should remove the connection from state', async () => {
      const config = createConnection({ id: 'conn-1' })
      useConnectionStore.getState().addConnection(config)

      await useConnectionStore.getState().deleteConnection('conn-1')

      expect(useConnectionStore.getState().connections).toHaveLength(0)
    })

    it('should persist updated connections via config.set', async () => {
      const config1 = createConnection({ id: 'conn-1' })
      const config2 = createConnection({ id: 'conn-2' })
      useConnectionStore.getState().addConnection(config1)
      useConnectionStore.getState().addConnection(config2)

      await useConnectionStore.getState().deleteConnection('conn-1')

      expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS, [config2])
    })

    it('should call hostKey.delete with the connection id', async () => {
      const config = createConnection({ id: 'conn-1' })
      useConnectionStore.getState().addConnection(config)

      await useConnectionStore.getState().deleteConnection('conn-1')

      expect(mockHostKeyDelete).toHaveBeenCalledWith('conn-1')
    })

    it('should not affect other connections', async () => {
      const config1 = createConnection({ id: 'conn-1', name: 'First' })
      const config2 = createConnection({ id: 'conn-2', name: 'Second' })
      useConnectionStore.getState().addConnection(config1)
      useConnectionStore.getState().addConnection(config2)

      await useConnectionStore.getState().deleteConnection('conn-1')

      expect(useConnectionStore.getState().connections).toHaveLength(1)
      const conn = useConnectionStore.getState().connections[0]
      if (!conn) throw new Error('Expected connection')
      expect(conn.id).toBe('conn-2')
    })

    it('should handle deleting non-existent connection gracefully', async () => {
      const config = createConnection({ id: 'conn-1' })
      useConnectionStore.getState().addConnection(config)

      await useConnectionStore.getState().deleteConnection('conn-nonexistent')

      expect(useConnectionStore.getState().connections).toHaveLength(1)
      // Should still call config.set with the unchanged list
      expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS, [config])
      // Should still call hostKey.delete for the non-existent id
      expect(mockHostKeyDelete).toHaveBeenCalledWith('conn-nonexistent')
    })
  })

  describe('loadSavedConnections', () => {
    it('should load connections from config.get result', async () => {
      const savedConnections = [
        createConnection({ id: 'conn-1', name: 'Saved 1' }),
        createConnection({ id: 'conn-2', name: 'Saved 2' }),
      ]
      mockConfigGet.mockImplementation((key: string) => {
        if (key === STORE_KEY.SAVED_CONNECTIONS) {
          return Promise.resolve(ok(savedConnections))
        }
        if (key === STORE_KEY.UI_SETTINGS) {
          return Promise.resolve(ok({ connectionSortOrder: SORT_ORDER.ASC }))
        }
        return Promise.resolve(err(new Error('not found')))
      })

      await useConnectionStore.getState().loadSavedConnections()

      expect(useConnectionStore.getState().connections).toEqual(savedConnections)
    })

    it('should load sortOrder from uiSettings', async () => {
      mockConfigGet.mockImplementation((key: string) => {
        if (key === STORE_KEY.SAVED_CONNECTIONS) {
          return Promise.resolve(ok([]))
        }
        if (key === STORE_KEY.UI_SETTINGS) {
          return Promise.resolve(ok({ connectionSortOrder: SORT_ORDER.DESC }))
        }
        return Promise.resolve(err(new Error('not found')))
      })

      await useConnectionStore.getState().loadSavedConnections()

      expect(useConnectionStore.getState().sortOrder).toBe(SORT_ORDER.DESC)
    })

    it('should default sortOrder to none when uiSettings has no connectionSortOrder', async () => {
      mockConfigGet.mockImplementation((key: string) => {
        if (key === STORE_KEY.SAVED_CONNECTIONS) {
          return Promise.resolve(ok([]))
        }
        if (key === STORE_KEY.UI_SETTINGS) {
          return Promise.resolve(ok({}))
        }
        return Promise.resolve(err(new Error('not found')))
      })

      await useConnectionStore.getState().loadSavedConnections()

      expect(useConnectionStore.getState().sortOrder).toBe(SORT_ORDER.NONE)
    })

    it('should not update connections when config.get returns error', async () => {
      const existing = createConnection({ id: 'conn-1' })
      useConnectionStore.setState({ connections: [existing] })

      mockConfigGet.mockImplementation((key: string) => {
        if (key === STORE_KEY.SAVED_CONNECTIONS) {
          return Promise.resolve(err(new Error('failed')))
        }
        if (key === STORE_KEY.UI_SETTINGS) {
          return Promise.resolve(err(new Error('failed')))
        }
        return Promise.resolve(err(new Error('not found')))
      })

      await useConnectionStore.getState().loadSavedConnections()

      // Should keep existing connections unchanged
      expect(useConnectionStore.getState().connections).toEqual([existing])
    })

    it('should not update connections when config.get returns non-array value', async () => {
      const existing = createConnection({ id: 'conn-1' })
      useConnectionStore.setState({ connections: [existing] })

      mockConfigGet.mockImplementation((key: string) => {
        if (key === STORE_KEY.SAVED_CONNECTIONS) {
          return Promise.resolve(ok('not an array'))
        }
        if (key === STORE_KEY.UI_SETTINGS) {
          return Promise.resolve(ok({}))
        }
        return Promise.resolve(err(new Error('not found')))
      })

      await useConnectionStore.getState().loadSavedConnections()

      expect(useConnectionStore.getState().connections).toEqual([existing])
    })

    it('should call config.get with correct store keys', async () => {
      await useConnectionStore.getState().loadSavedConnections()

      expect(mockConfigGet).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS)
      expect(mockConfigGet).toHaveBeenCalledWith(STORE_KEY.UI_SETTINGS)
    })
  })

  describe('saveConnectionConfigs', () => {
    it('should persist current connections via config.set', async () => {
      const config1 = createConnection({ id: 'conn-1' })
      const config2 = createConnection({ id: 'conn-2' })
      useConnectionStore.setState({ connections: [config1, config2] })

      await useConnectionStore.getState().saveConnectionConfigs()

      expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS, [config1, config2])
    })

    it('should persist empty array when no connections', async () => {
      await useConnectionStore.getState().saveConnectionConfigs()

      expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS, [])
    })
  })

  describe('setPendingConnectionConfig', () => {
    it('should set pendingConnectionConfig and pendingIsEditing to true', () => {
      const config = createConnection({ id: 'conn-1', name: 'Pending' })
      useConnectionStore.getState().setPendingConnectionConfig(config, true)

      expect(useConnectionStore.getState().pendingConnectionConfig).toEqual(config)
      expect(useConnectionStore.getState().pendingIsEditing).toBe(true)
    })

    it('should set pendingConnectionConfig and pendingIsEditing to false', () => {
      const config = createConnection({ id: 'conn-1' })
      useConnectionStore.getState().setPendingConnectionConfig(config, false)

      expect(useConnectionStore.getState().pendingConnectionConfig).toEqual(config)
      expect(useConnectionStore.getState().pendingIsEditing).toBe(false)
    })

    it('should clear pendingConnectionConfig when config is null', () => {
      const config = createConnection({ id: 'conn-1' })
      useConnectionStore.getState().setPendingConnectionConfig(config, true)
      useConnectionStore.getState().setPendingConnectionConfig(null, false)

      expect(useConnectionStore.getState().pendingConnectionConfig).toBeNull()
      expect(useConnectionStore.getState().pendingIsEditing).toBe(false)
    })
  })

  describe('setCloseConnectionDialog', () => {
    it('should set closeConnectionDialog to true', () => {
      useConnectionStore.getState().setCloseConnectionDialog(true)
      expect(useConnectionStore.getState().closeConnectionDialog).toBe(true)
    })

    it('should set closeConnectionDialog to false', () => {
      useConnectionStore.getState().setCloseConnectionDialog(true)
      useConnectionStore.getState().setCloseConnectionDialog(false)
      expect(useConnectionStore.getState().closeConnectionDialog).toBe(false)
    })
  })

  describe('setSortOrder', () => {
    it('should update sortOrder in state', async () => {
      await useConnectionStore.getState().setSortOrder(SORT_ORDER.ASC)

      expect(useConnectionStore.getState().sortOrder).toBe(SORT_ORDER.ASC)
    })

    it('should persist sortOrder to uiSettings via config.set', async () => {
      const existingSettings = {
        appearance: 'dark',
        locale: 'zh-CN',
        connectionSortOrder: SORT_ORDER.NONE,
      }
      mockConfigGet.mockResolvedValue(ok(existingSettings))

      await useConnectionStore.getState().setSortOrder(SORT_ORDER.DESC)

      expect(mockConfigGet).toHaveBeenCalledWith(STORE_KEY.UI_SETTINGS)
      expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.UI_SETTINGS, {
        ...existingSettings,
        connectionSortOrder: SORT_ORDER.DESC,
      })
    })

    it('should not persist when config.get returns error', async () => {
      mockConfigGet.mockResolvedValue(err(new Error('failed')))

      await useConnectionStore.getState().setSortOrder(SORT_ORDER.ASC)

      // State should still update
      expect(useConnectionStore.getState().sortOrder).toBe(SORT_ORDER.ASC)
      // But config.set should not be called for UI_SETTINGS
      expect(mockConfigSet).not.toHaveBeenCalledWith(STORE_KEY.UI_SETTINGS, expect.anything())
    })
  })

  describe('reorderConnections', () => {
    it('should move a connection before another', async () => {
      const conn1 = createConnection({ id: 'conn-1', name: 'A' })
      const conn2 = createConnection({ id: 'conn-2', name: 'B' })
      const conn3 = createConnection({ id: 'conn-3', name: 'C' })
      useConnectionStore.setState({ connections: [conn1, conn2, conn3] })

      // Move conn-3 before conn-1
      await useConnectionStore.getState().reorderConnections('conn-3', 'conn-1')

      const ids = useConnectionStore.getState().connections.map(c => c.id)
      expect(ids).toEqual(['conn-3', 'conn-1', 'conn-2'])
    })

    it('should move a connection forward', async () => {
      const conn1 = createConnection({ id: 'conn-1', name: 'A' })
      const conn2 = createConnection({ id: 'conn-2', name: 'B' })
      const conn3 = createConnection({ id: 'conn-3', name: 'C' })
      useConnectionStore.setState({ connections: [conn1, conn2, conn3] })

      // Move conn-1 before conn-3: splice removes conn-1, then inserts at index 2
      await useConnectionStore.getState().reorderConnections('conn-1', 'conn-3')

      const ids = useConnectionStore.getState().connections.map(c => c.id)
      expect(ids).toEqual(['conn-2', 'conn-3', 'conn-1'])
    })

    it('should reset sortOrder to none after reorder', async () => {
      const conn1 = createConnection({ id: 'conn-1', name: 'A' })
      const conn2 = createConnection({ id: 'conn-2', name: 'B' })
      useConnectionStore.setState({ connections: [conn1, conn2], sortOrder: SORT_ORDER.ASC })

      await useConnectionStore.getState().reorderConnections('conn-2', 'conn-1')

      expect(useConnectionStore.getState().sortOrder).toBe(SORT_ORDER.NONE)
    })

    it('should persist connections and sortOrder after reorder', async () => {
      const conn1 = createConnection({ id: 'conn-1', name: 'A' })
      const conn2 = createConnection({ id: 'conn-2', name: 'B' })
      useConnectionStore.setState({ connections: [conn1, conn2] })
      mockConfigGet.mockResolvedValue(ok({ connectionSortOrder: SORT_ORDER.ASC }))

      await useConnectionStore.getState().reorderConnections('conn-2', 'conn-1')

      // saveConnectionConfigs should be called
      expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS, expect.any(Array))
      // saveSortOrderToSettings should be called
      expect(mockConfigSet).toHaveBeenCalledWith(
        STORE_KEY.UI_SETTINGS,
        expect.objectContaining({
          connectionSortOrder: SORT_ORDER.NONE,
        })
      )
    })

    it('should not change order when activeId is not found', async () => {
      const conn1 = createConnection({ id: 'conn-1', name: 'A' })
      const conn2 = createConnection({ id: 'conn-2', name: 'B' })
      useConnectionStore.setState({ connections: [conn1, conn2] })

      await useConnectionStore.getState().reorderConnections('conn-999', 'conn-1')

      const ids = useConnectionStore.getState().connections.map(c => c.id)
      expect(ids).toEqual(['conn-1', 'conn-2'])
      // Should not persist when no reorder happened
      expect(mockConfigSet).not.toHaveBeenCalled()
    })

    it('should not change order when overId is not found', async () => {
      const conn1 = createConnection({ id: 'conn-1', name: 'A' })
      const conn2 = createConnection({ id: 'conn-2', name: 'B' })
      useConnectionStore.setState({ connections: [conn1, conn2] })

      await useConnectionStore.getState().reorderConnections('conn-1', 'conn-999')

      const ids = useConnectionStore.getState().connections.map(c => c.id)
      expect(ids).toEqual(['conn-1', 'conn-2'])
    })
  })

  describe('sortConnections', () => {
    it('should sort connections by name ascending', async () => {
      const conn1 = createConnection({ id: 'conn-1', name: 'Charlie' })
      const conn2 = createConnection({ id: 'conn-2', name: 'Alice' })
      const conn3 = createConnection({ id: 'conn-3', name: 'Bob' })
      useConnectionStore.setState({ connections: [conn1, conn2, conn3] })

      await useConnectionStore.getState().sortConnections(SORT_ORDER.ASC)

      const names = useConnectionStore.getState().connections.map(c => c.name)
      expect(names).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    it('should sort connections by name descending', async () => {
      const conn1 = createConnection({ id: 'conn-1', name: 'Charlie' })
      const conn2 = createConnection({ id: 'conn-2', name: 'Alice' })
      const conn3 = createConnection({ id: 'conn-3', name: 'Bob' })
      useConnectionStore.setState({ connections: [conn1, conn2, conn3] })

      await useConnectionStore.getState().sortConnections(SORT_ORDER.DESC)

      const names = useConnectionStore.getState().connections.map(c => c.name)
      expect(names).toEqual(['Charlie', 'Bob', 'Alice'])
    })

    it('should update sortOrder in state', async () => {
      const conn1 = createConnection({ id: 'conn-1', name: 'A' })
      useConnectionStore.setState({ connections: [conn1] })

      await useConnectionStore.getState().sortConnections(SORT_ORDER.ASC)
      expect(useConnectionStore.getState().sortOrder).toBe(SORT_ORDER.ASC)

      await useConnectionStore.getState().sortConnections(SORT_ORDER.DESC)
      expect(useConnectionStore.getState().sortOrder).toBe(SORT_ORDER.DESC)
    })

    it('should persist sorted connections and sortOrder', async () => {
      const conn1 = createConnection({ id: 'conn-1', name: 'B' })
      const conn2 = createConnection({ id: 'conn-2', name: 'A' })
      useConnectionStore.setState({ connections: [conn1, conn2] })
      mockConfigGet.mockResolvedValue(ok({ connectionSortOrder: SORT_ORDER.NONE }))

      await useConnectionStore.getState().sortConnections(SORT_ORDER.ASC)

      // saveConnectionConfigs should be called with sorted connections
      expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS, expect.any(Array))
      // saveSortOrderToSettings should be called
      expect(mockConfigSet).toHaveBeenCalledWith(
        STORE_KEY.UI_SETTINGS,
        expect.objectContaining({
          connectionSortOrder: SORT_ORDER.ASC,
        })
      )
    })

    it('should handle empty connections array', async () => {
      useConnectionStore.setState({ connections: [] })

      await useConnectionStore.getState().sortConnections(SORT_ORDER.ASC)

      expect(useConnectionStore.getState().connections).toEqual([])
      expect(useConnectionStore.getState().sortOrder).toBe(SORT_ORDER.ASC)
    })
  })

  describe('getConnectionById', () => {
    it('should return the connection with matching id', () => {
      const config = createConnection({ id: 'conn-1', name: 'Found' })
      useConnectionStore.setState({ connections: [config] })

      const result = useConnectionStore.getState().getConnectionById('conn-1')

      expect(result).toEqual(config)
    })

    it('should return undefined when no connection matches', () => {
      const config = createConnection({ id: 'conn-1' })
      useConnectionStore.setState({ connections: [config] })

      const result = useConnectionStore.getState().getConnectionById('conn-999')

      expect(result).toBeUndefined()
    })

    it('should return undefined when connections is empty', () => {
      const result = useConnectionStore.getState().getConnectionById('conn-1')

      expect(result).toBeUndefined()
    })

    it('should return the correct connection when multiple exist', () => {
      const conn1 = createConnection({ id: 'conn-1', name: 'First' })
      const conn2 = createConnection({ id: 'conn-2', name: 'Second' })
      useConnectionStore.setState({ connections: [conn1, conn2] })

      const result = useConnectionStore.getState().getConnectionById('conn-2')

      expect(result?.name).toBe('Second')
    })
  })
})
