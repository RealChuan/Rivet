import Store from 'electron-store'
import { logger } from '../utils/index.js'
import {
  type Result,
  ok,
  err,
  type ErrorInfo,
  createErrorInfo,
  type HostKey,
} from '@shared/types/index.js'
import crypto from 'crypto'

interface KnownHostsStore {
  knownHosts: HostKey[]
}

const KNOWN_HOSTS_KEY = 'knownHosts'

const store = new Store<KnownHostsStore>({
  name: 'known-hosts',
  defaults: { knownHosts: [] },
})

function computeChecksum(record: Omit<HostKey, 'checksum'>): string {
  const data = `${record.connectionId}${record.hash}${record.createdAt}`
  return crypto.createHash('sha256').update(data).digest('hex')
}

export function getHostKeyRecord(connectionId: string): Result<HostKey | undefined, ErrorInfo> {
  try {
    const host = store.get(KNOWN_HOSTS_KEY).find(h => h.connectionId === connectionId)
    if (host?.checksum) {
      const { checksum, ...recordWithoutChecksum } = host
      const computedChecksum = computeChecksum(recordWithoutChecksum)
      if (checksum !== computedChecksum) {
        logger.error(`Host key checksum verification failed for connection: ${connectionId}`)
        return err(createErrorInfo('HOST_KEY_ERROR', 'Host key data corrupted'))
      }
    }
    return ok(host)
  } catch (error) {
    logger.catch(error, { connectionId, action: 'get-known-host' })
    return err(createErrorInfo('HOST_KEY_ERROR', 'Failed to read known host'))
  }
}

export function saveHostKeyRecord(record: Omit<HostKey, 'createdAt'>): Result<void, ErrorInfo> {
  try {
    const hosts = store.get(KNOWN_HOSTS_KEY)
    const idx = hosts.findIndex(h => h.connectionId === record.connectionId)

    const createdAt = Date.now()
    const hostRecordWithCreatedAt = { ...record, createdAt }
    const checksum = computeChecksum(hostRecordWithCreatedAt)

    const hostRecord: HostKey = {
      ...hostRecordWithCreatedAt,
      checksum,
    }

    if (idx >= 0) {
      hosts[idx] = hostRecord
    } else {
      hosts.push(hostRecord)
    }

    store.set(KNOWN_HOSTS_KEY, hosts)
    logger.info(`Saved host key for connection: ${record.connectionId}`)
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { connectionId: record.connectionId, action: 'save-known-host' })
    return err(createErrorInfo('HOST_KEY_ERROR', 'Failed to save host key'))
  }
}

export function removeHostKeyRecord(connectionId: string): Result<void, ErrorInfo> {
  try {
    const hosts = store.get(KNOWN_HOSTS_KEY)
    const filteredHosts = hosts.filter(h => h.connectionId !== connectionId)
    store.set(KNOWN_HOSTS_KEY, filteredHosts)
    logger.info(`Deleted host key for connection: ${connectionId}`)
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { connectionId, action: 'delete-known-host' })
    return err(createErrorInfo('HOST_KEY_ERROR', 'Failed to delete host key'))
  }
}
