import { create } from 'zustand'
import { type ConnectionConfig } from '@shared/types/index.js'
import { type UiSettings } from '@shared/types/ui.js'
import { isOk } from '@shared/types/result.js'
import { SORT_ORDER_NONE, SORT_ORDER_ASC } from '@shared/constants/sort.js'
import type { SortOrder, SortOrderWithDirection } from '@shared/constants/sort.js' // eslint-disable-line no-duplicate-imports
import { STORE_KEYS } from '@shared/constants/config.js'

const saveSortOrderToSettings = async (order: SortOrder) => {
  const currentSettings = await window.electronAPI.config.get(STORE_KEYS.UI_SETTINGS)
  if (isOk(currentSettings)) {
    await window.electronAPI.config.set(STORE_KEYS.UI_SETTINGS, {
      ...(currentSettings.value as UiSettings),
      connectionSortOrder: order,
    })
  }
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
  sortOrder: SORT_ORDER_NONE,

  getConnectionById: connectionId => {
    return get().connections.find(c => c.id === connectionId)
  },

  addConnection: config => {
    set(state => ({
      connections: [...state.connections, config],
    }))

    return config.id
  },

  updateConnection: config => {
    set(state => ({
      connections: state.connections.map(c => (c.id === config.id ? config : c)),
    }))
  },

  deleteConnection: async connectionId => {
    const updatedConnections = get().connections.filter(c => c.id !== connectionId)
    set({ connections: updatedConnections })

    await window.electronAPI.config.set(STORE_KEYS.SAVED_CONNECTIONS, updatedConnections)
    await window.electronAPI.hostKey.delete(connectionId)
  },

  loadSavedConnections: async () => {
    const result = await window.electronAPI.config.get(STORE_KEYS.SAVED_CONNECTIONS)
    if (isOk(result) && Array.isArray(result.value)) {
      set({ connections: result.value as ConnectionConfig[] })
    }

    const uiSettingsResult = await window.electronAPI.config.get(STORE_KEYS.UI_SETTINGS)
    if (isOk(uiSettingsResult)) {
      set({
        sortOrder: (uiSettingsResult.value as UiSettings).connectionSortOrder || SORT_ORDER_NONE,
      })
    }
  },

  saveConnectionConfigs: async () => {
    await window.electronAPI.config.set(STORE_KEYS.SAVED_CONNECTIONS, get().connections)
  },

  setPendingConnectionConfig: (config, isEditing) => {
    set({ pendingConnectionConfig: config, pendingIsEditing: isEditing })
  },

  setCloseConnectionDialog: close => {
    set({ closeConnectionDialog: close })
  },

  setSortOrder: async order => {
    set({ sortOrder: order })
    await saveSortOrderToSettings(order)
  },

  reorderConnections: async (activeId, overId) => {
    const connections = [...get().connections]
    const oldIndex = connections.findIndex(c => c.id === activeId)
    const newIndex = connections.findIndex(c => c.id === overId)

    if (oldIndex !== -1 && newIndex !== -1) {
      const [removed] = connections.splice(oldIndex, 1)
      if (removed) {
        connections.splice(newIndex, 0, removed)
      }
      set({ connections, sortOrder: SORT_ORDER_NONE })
      await get().saveConnectionConfigs()
      await saveSortOrderToSettings(SORT_ORDER_NONE)
    }
  },

  sortConnections: async order => {
    const connections = [...get().connections].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name)
      return order === SORT_ORDER_ASC ? comparison : -comparison
    })
    set({ connections, sortOrder: order })
    await get().saveConnectionConfigs()
    await saveSortOrderToSettings(order)
  },
}))

export default useConnectionStore
