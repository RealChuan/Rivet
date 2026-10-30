import type { ConnectRequest, Session } from '@shared/types/index.js'
import { ROOT_PATH } from '@shared/constants/index.js'
import { useConnectionStore } from '../stores/connection.js'
import { useSessionStore } from '../stores/session.js'
import { handleConnectWithHostKey } from './host-key-connect.js'

export function useSessionConnect() {
  const connectSession = async (request: ConnectRequest): Promise<boolean> => {
    let result = await handleConnectWithHostKey(request)

    while (result.retry) {
      result = await handleConnectWithHostKey(request)
    }

    if (!result.success || !result.sessionId) {
      return false
    }

    const session: Session = {
      sessionId: result.sessionId,
      connectionId: request.connection.id,
      currentPath: ROOT_PATH,
      isConnected: true,
      isOperating: false,
    }

    useSessionStore.getState().replaceSession(request.connection.id, session)

    return true
  }

  const reconnectSession = async (
    connectionId: string,
    secret?: string,
    saveSecret?: boolean,
  ): Promise<boolean> => {
    const connection = useConnectionStore.getState().getConnectionById(connectionId)
    if (!connection) throw new Error('Connection not found')

    return connectSession({
      connection,
      ...(secret ? { secret } : {}),
      ...(saveSecret !== undefined ? { saveSecret } : {}),
    })
  }

  return { connectSession, reconnectSession }
}
