import type { ConnectionConfig, Session } from '@shared/types/index.js'
import { ROOT_PATH } from '@shared/constants/index.js'
import { useConnectionStore } from '../stores/connection.js'
import { useSessionStore } from '../stores/session.js'
import { handleConnectWithHostKey } from './host-key-connect.js'

export function useSessionConnect() {
  const connectSession = async (config: ConnectionConfig): Promise<boolean> => {
    let result = await handleConnectWithHostKey(config)

    while (result.retry) {
      result = await handleConnectWithHostKey(config)
    }

    if (!result.success || !result.sessionId) {
      return false
    }

    const session: Session = {
      sessionId: result.sessionId,
      connectionId: config.id,
      currentPath: ROOT_PATH,
      files: [],
      isConnected: true,
      isLoading: false,
      isOperating: false,
      error: null,
    }

    useSessionStore.getState().replaceSession(config.id, session)

    await useSessionStore.getState().refreshCurrentDirectory(result.sessionId)

    return true
  }

  const reconnectSession = async (
    connectionId: string,
    passwordConfig?: Partial<{ password?: string; savePassword?: boolean }>,
  ): Promise<boolean> => {
    const connection = useConnectionStore.getState().getConnectionById(connectionId)
    if (!connection) throw new Error('Connection not found')

    const configToConnect = passwordConfig ? { ...connection, ...passwordConfig } : connection
    return connectSession(configToConnect)
  }

  return { connectSession, reconnectSession }
}
