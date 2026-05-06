import path from 'node:path'
import { ERROR_CODE } from '@shared/constants/index.js'
import { connectionsFileSchema, type ConnectionsFile } from '@shared/schemas/config.js'
import {
  createErrorInfo,
  err,
  type ErrorInfo,
  ok,
  type Result,
  type ConnectionConfig,
} from '@shared/types/index.js'
import { logger } from '../utils/index.js'
import { JsonStore } from './json-store.js'
import { decryptSecret, encryptSecret } from './secrets.js'

let connectionsStore: JsonStore<ConnectionsFile> | null = null

function requireStore(): JsonStore<ConnectionsFile> {
  if (!connectionsStore) {
    throw new Error('connections store is not initialized')
  }
  return connectionsStore
}

export function initializeConnections(baseDir: string): void {
  connectionsStore = new JsonStore<ConnectionsFile>({
    filePath: path.join(baseDir, 'connections.json'),
    schema: connectionsFileSchema,
    createDefault: () => ({ schemaVersion: 1, connections: [], secrets: {} }),
  })
}

export function getConnections(): ConnectionConfig[] {
  const file = requireStore().get()
  return file.connections.map((connection) => ({
    ...connection,
    askPasswordOnConnect:
      (connection.authKind ?? 'password') === 'password' && !file.secrets[connection.id],
  }))
}

export function replaceConnections(list: ConnectionConfig[]): Result<void, ErrorInfo> {
  try {
    requireStore().update((current) => {
      const ids = new Set(list.map((connection) => connection.id))
      const secrets = Object.fromEntries(
        Object.entries(current.secrets).filter(([id]) => ids.has(id)),
      )
      const connections = list.map((connection) => {
        const { askPasswordOnConnect: _runtime, ...persisted } = connection
        return {
          ...persisted,
          authKind: connection.authKind ?? 'password',
          ...(secrets[connection.id] ? { secretRef: connection.id } : { secretRef: undefined }),
        }
      })
      return { ...current, connections, secrets }
    })
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'replace-connections' })
    return err(createErrorInfo(ERROR_CODE.INVALID_CONFIG, 'Invalid connection list'))
  }
}

export async function getConnectionSecret(
  id: string,
): Promise<Result<string | undefined, ErrorInfo>> {
  const stored = requireStore().get().secrets[id]
  if (!stored) return ok(undefined)
  return decryptSecret(stored)
}

export async function saveConnectionSecret(
  id: string,
  plain: string,
): Promise<Result<{ stored: boolean }, ErrorInfo>> {
  const encrypted = await encryptSecret(plain)
  if (!encrypted) return ok({ stored: false })

  requireStore().update((current) => {
    const connections = current.connections.map((connection) =>
      connection.id === id ? { ...connection, secretRef: id } : connection,
    )
    return {
      ...current,
      connections,
      secrets: { ...current.secrets, [id]: encrypted },
    }
  })
  return ok({ stored: true })
}

export function deleteConnectionSecret(id: string): void {
  requireStore().update((current) => {
    const secrets = { ...current.secrets }
    delete secrets[id]
    return {
      ...current,
      connections: current.connections.map((connection) =>
        connection.id === id ? { ...connection, secretRef: undefined } : connection,
      ),
      secrets,
    }
  })
}

export async function flushConnections(): Promise<void> {
  await connectionsStore?.flush()
}

export async function disposeConnections(): Promise<void> {
  await connectionsStore?.dispose()
  connectionsStore = null
}
