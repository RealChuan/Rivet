import type { ConnectRequest, Session } from '@shared/types/index.js'
import { ERROR_CODE, FILE_TYPE, ROOT_PATH } from '@shared/constants/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { isApiError } from '../../../api/result.js'
import { useConnectRequestsStore } from '../stores/connect-requests.js'
import { useConnectionStore } from '../stores/connection.js'
import { useLastPathsStore } from '../stores/last-paths.js'
import { useSessionStore } from '../stores/session.js'
import { handleConnectWithHostKey } from './host-key-connect.js'

/**
 * 连接结果四态。`cancelled` 与 `busy` 都不是失败：前者是用户主动放弃，后者是同一台已有连接在跑。
 * 区分它们是为了让调用方既不弹失败提示，也不误开重连对话框。
 */
export type ConnectOutcome =
  | { status: 'connected' }
  | { status: 'failed'; error: unknown }
  | { status: 'cancelled' }
  | { status: 'busy' }

function isAborted(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (isApiError(error) && error.code === ERROR_CODE.REQUEST_ABORTED)
}

/** 恢复上次停留的目录：先 `stat` 确认，失效就静默回到根目录，别让连接一上来就进错误态。 */
async function resolveInitialPath(
  sessionId: string,
  connectionId: string,
  signal: AbortSignal,
): Promise<string> {
  const remembered = useLastPathsStore.getState().getPath(connectionId)
  if (!remembered || remembered === ROOT_PATH) return ROOT_PATH

  try {
    const entry = await protocolApi.stat(sessionId, remembered, signal)
    return entry.type === FILE_TYPE.DIRECTORY ? remembered : ROOT_PATH
  } catch {
    return ROOT_PATH
  }
}

export function useSessionConnect() {
  const connectSession = async (request: ConnectRequest): Promise<ConnectOutcome> => {
    const connectionId = request.connection.id
    const signal = useConnectRequestsStore.getState().begin(connectionId)
    if (!signal) return { status: 'busy' }

    try {
      let result = await handleConnectWithHostKey(request, signal)

      while (result.retry) {
        result = await handleConnectWithHostKey(request, signal)
      }

      // success 为 false 只可能是用户在指纹对话框上取消：`protocol.connect` 的失败一律是抛异常。
      if (!result.success || !result.sessionId) {
        return { status: 'cancelled' }
      }

      const sessionId = result.sessionId
      const currentPath = await resolveInitialPath(sessionId, connectionId, signal)

      if (signal.aborted) {
        // 取消可能落在 connect 成功之后：主进程已经注册了会话，必须显式收掉再退出，
        // 否则界面上没有这条连接，主进程却留着一个活会话。
        await protocolApi.disconnect(sessionId).catch(() => {})
        return { status: 'cancelled' }
      }

      const session: Session = {
        sessionId,
        connectionId,
        currentPath,
        isConnected: true,
        isOperating: false,
      }

      useSessionStore.getState().replaceSession(connectionId, session)

      return { status: 'connected' }
    } catch (error) {
      return isAborted(error, signal) ? { status: 'cancelled' } : { status: 'failed', error }
    } finally {
      useConnectRequestsStore.getState().end(connectionId)
    }
  }

  const reconnectSession = async (
    connectionId: string,
    secret?: string,
    saveSecret?: boolean,
  ): Promise<ConnectOutcome> => {
    const connection = useConnectionStore.getState().getConnectionById(connectionId)
    if (!connection) throw new Error('Connection not found')

    return connectSession({
      connection,
      ...(secret ? { secret } : {}),
      ...(saveSecret !== undefined ? { saveSecret } : {}),
    })
  }

  const cancelConnect = (connectionId: string): void => {
    useConnectRequestsStore.getState().cancel(connectionId)
  }

  const cancelLatestConnect = (): void => {
    useConnectRequestsStore.getState().cancelLatest()
  }

  return { connectSession, reconnectSession, cancelConnect, cancelLatestConnect }
}
