import { arrayMove } from '@dnd-kit/sortable'
import { create } from 'zustand'
import {
  PROTOCOL,
  SORT_ORDER,
  type SortOrder,
  type SortOrderWithDirection,
  STORE_KEY,
} from '@shared/constants/index.js'
import { type ConnectionConfig, isOk } from '@shared/types/index.js'

const saveSortOrderToSettings = async (order: SortOrder) => {
  await window.electronAPI.config.set(STORE_KEY.CONNECTION_SORT_ORDER, order)
}

function isConnectionConfig(item: unknown): item is ConnectionConfig {
  if (item === null || typeof item !== 'object') return false
  return (
    'id' in item &&
    typeof item.id === 'string' &&
    'name' in item &&
    typeof item.name === 'string' &&
    'host' in item &&
    typeof item.host === 'string' &&
    'username' in item &&
    typeof item.username === 'string' &&
    'port' in item &&
    typeof item.port === 'number' &&
    'protocol' in item &&
    typeof item.protocol === 'string' &&
    (item.protocol === PROTOCOL.SFTP || item.protocol === PROTOCOL.WEBDAV)
  )
}

function isConnectionConfigArray(value: unknown): value is ConnectionConfig[] {
  return Array.isArray(value) && value.every(isConnectionConfig)
}

function isSortOrder(value: unknown): value is SortOrder {
  return value === SORT_ORDER.NONE || value === SORT_ORDER.ASC || value === SORT_ORDER.DESC
}

export interface ConnectionStore {
  connections: ConnectionConfig[]
  pendingConnectionConfig: ConnectionConfig | null
  pendingIsEditing: boolean
  closeConnectionDialog: boolean
  sortOrder: SortOrder

  addConnection: (config: ConnectionConfig) => string
  updateConnection: (config: ConnectionConfig) => void
  deleteConnection: (connectionId: string) => Promise<void>
  loadSavedConnections: () => Promise<void>
  loadSortOrderFromSettings: () => Promise<void>
  saveConnectionConfigs: () => Promise<void>
  setPendingConnectionConfig: (config: ConnectionConfig | null, isEditing: boolean) => void
  setCloseConnectionDialog: (close: boolean) => void
  setSortOrder: (order: SortOrder) => Promise<void>
  reorderConnections: (activeId: string, overId: string) => Promise<void>
  sortConnections: (order: SortOrderWithDirection) => Promise<void>

  getConnectionById: (connectionId: string) => ConnectionConfig | undefined
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  connections: [],
  pendingConnectionConfig: null,
  pendingIsEditing: false,
  closeConnectionDialog: false,
  sortOrder: SORT_ORDER.NONE,

  getConnectionById: (connectionId) => {
    return get().connections.find((c) => c.id === connectionId)
  },

  addConnection: (config) => {
    set((state) => ({
      connections: [...state.connections, config],
    }))

    return config.id
  },

  updateConnection: (config) => {
    set((state) => ({
      connections: state.connections.map((c) => (c.id === config.id ? config : c)),
    }))
  },

  deleteConnection: async (connectionId) => {
    const updatedConnections = get().connections.filter((c) => c.id !== connectionId)
    set({ connections: updatedConnections })

    await window.electronAPI.config.set(STORE_KEY.SAVED_CONNECTIONS, updatedConnections)
    await window.electronAPI.hostKey.delete(connectionId)
  },

  loadSavedConnections: async () => {
    const result = await window.electronAPI.config.get(STORE_KEY.SAVED_CONNECTIONS)
    if (isOk(result) && isConnectionConfigArray(result.value)) {
      set({ connections: result.value })
    }
  },

  loadSortOrderFromSettings: async () => {
    const result = await window.electronAPI.config.get(STORE_KEY.CONNECTION_SORT_ORDER)
    if (isOk(result) && isSortOrder(result.value)) {
      set({ sortOrder: result.value })
    }
  },

  saveConnectionConfigs: async () => {
    await window.electronAPI.config.set(STORE_KEY.SAVED_CONNECTIONS, get().connections)
  },

  setPendingConnectionConfig: (config, isEditing) => {
    set({ pendingConnectionConfig: config, pendingIsEditing: isEditing })
  },

  setCloseConnectionDialog: (close) => {
    set({ closeConnectionDialog: close })
  },

  setSortOrder: async (order) => {
    set({ sortOrder: order })
    await saveSortOrderToSettings(order)
  },

  reorderConnections: async (activeId, overId) => {
    const connections = get().connections
    const oldIndex = connections.findIndex((c) => c.id === activeId)
    const newIndex = connections.findIndex((c) => c.id === overId)

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(connections, oldIndex, newIndex)
      set({ connections: reordered, sortOrder: SORT_ORDER.NONE })
      await get().saveConnectionConfigs()
      await saveSortOrderToSettings(SORT_ORDER.NONE)
    }
  },

  sortConnections: async (order) => {
    const connections = [...get().connections].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name)
      return order === SORT_ORDER.ASC ? comparison : -comparison
    })
    set({ connections, sortOrder: order })
    await get().saveConnectionConfigs()
    await saveSortOrderToSettings(order)
  },
}))
