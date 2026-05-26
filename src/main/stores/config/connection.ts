import { logger } from '../../utils/index.js'
import { ERROR_CODES } from '../constants.js'
import { getFromMemory, setToMemory } from './store.js'
import { isValidConnection } from './validation.js'
import {
  type ConnectionConfig,
  type Result,
  type ErrorInfo,
  ok,
  err,
  createErrorInfo,
} from '@shared/types/index.js'
import { STORE_KEYS } from '@shared/constants/index.js'

export function getConnectionConfigs(): Result<ConnectionConfig[], ErrorInfo> {
  try {
    return ok([...getFromMemory(STORE_KEYS.SAVED_CONNECTIONS)])
  } catch (error) {
    logger.catch(error, { action: 'get-connections' })
    return err(createErrorInfo(ERROR_CODES.CONFIG_ERROR, 'Failed to get saved connections'))
  }
}

export function saveConnectionConfig(config: ConnectionConfig): Result<void, ErrorInfo> {
  try {
    if (!isValidConnection(config)) {
      logger.error(`Invalid connection config rejected: ${JSON.stringify(config)}`)
      return err(createErrorInfo(ERROR_CODES.CONFIG_ERROR, 'Invalid connection configuration'))
    }

    const connectionToSave = { ...config }
    if (!connectionToSave.savePassword) {
      delete connectionToSave.password
    }

    const connections = [...getFromMemory(STORE_KEYS.SAVED_CONNECTIONS)]
    const index = connections.findIndex(c => c.id === config.id)

    if (index >= 0) {
      connections[index] = connectionToSave
    } else {
      connections.push(connectionToSave)
    }

    setToMemory(STORE_KEYS.SAVED_CONNECTIONS, connections)
    logger.info(`Connection ${index >= 0 ? 'updated' : 'added'}: ${config.name} (${config.id})`)
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'save-connection', configId: config.id })
    return err(createErrorInfo(ERROR_CODES.CONFIG_ERROR, 'Failed to save connection'))
  }
}

export function removeConnectionConfig(connectionId: string): Result<void, ErrorInfo> {
  try {
    const connections = getFromMemory(STORE_KEYS.SAVED_CONNECTIONS).filter(
      (c: { id: string }) => c.id !== connectionId
    )
    setToMemory(STORE_KEYS.SAVED_CONNECTIONS, connections)
    logger.info(`Connection deleted: ${connectionId}`)
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'delete-connection', connectionId })
    return err(createErrorInfo(ERROR_CODES.CONFIG_ERROR, 'Failed to delete connection'))
  }
}
