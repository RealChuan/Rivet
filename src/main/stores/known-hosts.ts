import Store from 'electron-store'
import type { HostKey } from '../../shared/types/host-key.js'
import { InternalStatus } from '../../shared/constants/protocol-status.js'
import { logger } from '../utils/index.js'

interface KnownHostsStore {
  knownHosts: HostKey[]
}

const store = new Store<KnownHostsStore>({
  name: 'known-hosts',
  defaults: { knownHosts: [] },
})

export function getKnownHost(connectionUuid: string): HostKey | undefined {
  try {
    return store.get('knownHosts').find(h => h.connectionUuid === connectionUuid)
  } catch (error) {
    logger.error(`Failed to read known host for ${connectionUuid}:`, error)
    return undefined
  }
}

export function saveKnownHost(record: Omit<HostKey, 'savedAt'>): {
  success: boolean
  error?: number
} {
  try {
    const hosts = store.get('knownHosts')
    const idx = hosts.findIndex(h => h.connectionUuid === record.connectionUuid)

    const hostRecord: HostKey = {
      ...record,
      savedAt: Date.now(),
    }

    if (idx >= 0) {
      hosts[idx] = hostRecord
    } else {
      hosts.push(hostRecord)
    }

    store.set('knownHosts', hosts)
    logger.info(`Saved host key for connection: ${record.connectionUuid}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to save known host for ${record.connectionUuid}:`, error)
    return { success: false, error: InternalStatus.STORE_ERROR }
  }
}

export function deleteKnownHost(connectionUuid: string): { success: boolean; error?: number } {
  try {
    const hosts = store.get('knownHosts')
    const filteredHosts = hosts.filter(h => h.connectionUuid !== connectionUuid)
    store.set('knownHosts', filteredHosts)
    logger.info(`Deleted host key for connection: ${connectionUuid}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to delete known host for ${connectionUuid}:`, error)
    return { success: false, error: InternalStatus.STORE_ERROR }
  }
}
