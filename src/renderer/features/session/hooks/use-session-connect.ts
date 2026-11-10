import type { ConnectRequest, Session } from '@shared/types/index.js'
import { FILE_TYPE, ROOT_PATH } from '@shared/constants/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { useConnectionStore } from '../stores/connection.js'
import { useLastPathsStore } from '../stores/last-paths.js'
import { useSessionStore } from '../stores/session.js'
import { handleConnectWithHostKey } from './host-key-connect.js'

/** 恢复上次停留的目录：先 `stat` 确认，失效就静默回到根目录，别让连接一上来就进错误态。 */
async function resolveInitialPath(sessionId: string, connectionId: string): Promise<string> {
  const remembered = useLastPathsStore.getState().getPath(connectionId)
  if (!remembered || remembered === ROOT_PATH) return ROOT_PATH

  try {
    const entry = await protocolApi.stat(sessionId, remembered)
    return entry.type === FILE_TYPE.DIRECTORY ? remembered : ROOT_PATH
  } catch {
    return ROOT_PATH
  }
}

export function useSessionConnect() {
  const connectSession = async (request: ConnectRequest): Promise<boolean> => {
    let result = await handleConnectWithHostKey(request)

    while (result.retry) {
      result = await handleConnectWithHostKey(request)
    }

    if (!result.success || !result.sessionId) {
      return false
    }

    const sessionId = result.sessionId
    const session: Session = {
      sessionId,
      connectionId: request.connection.id,
      currentPath: await resolveInitialPath(sessionId, request.connection.id),
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
