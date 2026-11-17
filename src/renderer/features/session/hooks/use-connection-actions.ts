import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConnectionConfig, ConnectionSaveInput } from '@shared/types/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { useActiveTaskGuard } from '../../../hooks/use-active-task-guard.js'
import { useUiStore } from '../../../stores/index.js'
import { logger } from '../../../utils/index.js'
import { useConnectionStore } from '../stores/connection.js'
import { useLastPathsStore } from '../stores/last-paths.js'
import { useSessionStore } from '../stores/session.js'
import { useSessionConnect } from './use-session-connect.js'

export const useConnectionActions = () => {
  const { t } = useTranslation()
  const { connectSession, cancelConnect, cancelLatestConnect } = useSessionConnect()
  const removeSession = useSessionStore((state) => state.removeSession)
  const getSessionByConnectionId = useSessionStore((state) => state.getSessionByConnectionId)
  const connections = useConnectionStore((state) => state.connections)
  const addConnection = useConnectionStore((state) => state.addConnection)
  const updateConnection = useConnectionStore((state) => state.updateConnection)
  const deleteConnection = useConnectionStore((state) => state.deleteConnection)
  const saveConnectionConfigs = useConnectionStore((state) => state.saveConnectionConfigs)
  const loadSavedConnections = useConnectionStore((state) => state.loadSavedConnections)
  const addToast = useUiStore((state) => state.addToast)
  const { guard, confirmOpen, handleConfirm, handleCancel, title, message } = useActiveTaskGuard()

  const [editConfig, setEditConfig] = useState<ConnectionConfig | null>(null)
  const [reconnectConfig, setReconnectConfig] = useState<ConnectionConfig | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null)

  const showConnectionToast = (
    type: typeof TOAST_TYPE.SUCCESS | typeof TOAST_TYPE.ERROR,
    config: { protocol: string; name: string },
  ) => {
    addToast({
      type,
      message: t(
        type === TOAST_TYPE.SUCCESS
          ? ($) => $.toast.connectionSuccess
          : ($) => $.toast.connectionFailed,
        {
          protocol: config.protocol.toUpperCase(),
          name: config.name,
        },
      ),
    })
  }

  /** 返回 true 表示已连接并保存；false 表示用户取消或已有连接在跑，对话框应留在原地。 */
  const handleSaveConnection = async (
    input: ConnectionSaveInput,
    onSuccess?: () => void,
  ): Promise<boolean> => {
    const connection: ConnectionConfig = {
      ...input.connection,
      id: editConfig?.id ?? crypto.randomUUID(),
    }

    const outcome = await connectSession({
      connection,
      ...(input.secret ? { secret: input.secret } : {}),
      saveSecret: input.saveSecret,
    })

    if (outcome.status === 'cancelled' || outcome.status === 'busy') return false

    if (outcome.status === 'failed') {
      // 失败必须给出入口反馈，并把原因抛给对话框展示。
      showConnectionToast(TOAST_TYPE.ERROR, connection)
      throw outcome.error
    }

    if (editConfig) updateConnection(connection)
    else addConnection(connection)

    await saveConnectionConfigs()
    await loadSavedConnections()
    showConnectionToast(TOAST_TYPE.SUCCESS, connection)
    onSuccess?.()
    setEditConfig(null)
    return true
  }

  const handleDisconnect = (connectionId: string) => {
    const connection = connections.find((c) => c.id === connectionId)
    const session = getSessionByConnectionId(connectionId)

    const doDisconnect = async () => {
      try {
        if (session) {
          await protocolApi.disconnect(session.sessionId)
          removeSession(session.sessionId)
        }
        addToast({
          type: TOAST_TYPE.INFO,
          message: t(($) => $.toast.disconnectSuccess, {
            protocol: connection
              ? connection.protocol.toUpperCase()
              : t(($) => $.error.unknownProtocol),
            name: connection?.name ?? connection?.host ?? t(($) => $.error.unknownName),
          }),
        })
      } catch (_error) {
        logger.catch(_error, { action: 'disconnect', connectionId })
        addToast({
          type: TOAST_TYPE.ERROR,
          message: t(($) => $.toast.disconnectFailed, {
            protocol: connection
              ? connection.protocol.toUpperCase()
              : t(($) => $.error.unknownProtocol),
            name: connection?.name ?? connection?.host ?? t(($) => $.error.unknownName),
          }),
        })
      }
    }

    if (session) {
      guard(() => void doDisconnect(), session.sessionId)
    } else {
      void doDisconnect()
    }
  }

  const handleDelete = (connectionId: string) => {
    setConnectionToDelete(connectionId)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!connectionToDelete) return
    try {
      const session = getSessionByConnectionId(connectionToDelete)
      if (session) {
        await protocolApi.disconnect(session.sessionId)
        removeSession(session.sessionId)
      }
      await deleteConnection(connectionToDelete)
      useLastPathsStore.getState().forget(connectionToDelete)
      addToast({ type: TOAST_TYPE.INFO, message: t(($) => $.toast.deleteConnectionSuccess) })
    } catch (error) {
      logger.catch(error, { connectionId: connectionToDelete, action: 'delete-connection' })
      addToast({ type: TOAST_TYPE.ERROR, message: t(($) => $.toast.deleteFailed) })
    } finally {
      setDeleteConfirmOpen(false)
      setConnectionToDelete(null)
    }
  }

  const handleReconnect = async (connection: ConnectionConfig, onOpenDialog?: () => void) => {
    if (connection.askPasswordOnConnect) {
      setReconnectConfig(connection)
      onOpenDialog?.()
      return
    }

    const outcome = await connectSession({ connection })

    if (outcome.status === 'connected') {
      showConnectionToast(TOAST_TYPE.SUCCESS, connection)
      return
    }
    // 用户主动取消、或这台已有连接在跑：都不该提示失败，也不该弹重连对话框。
    if (outcome.status === 'cancelled' || outcome.status === 'busy') return

    logger.catch(outcome.error, { connectionId: connection.id, action: 'reconnect' })
    showConnectionToast(TOAST_TYPE.ERROR, connection)
    setReconnectConfig(connection)
    onOpenDialog?.()
  }

  /** 返回 true 表示已连接；false 表示用户取消或已有连接在跑。 */
  const handleReconnectSubmit = async (input: ConnectionSaveInput): Promise<boolean> => {
    if (!reconnectConfig) return false

    const outcome = await connectSession({
      connection: reconnectConfig,
      ...(input.secret ? { secret: input.secret } : {}),
      saveSecret: input.saveSecret,
    })

    if (outcome.status === 'cancelled' || outcome.status === 'busy') return false

    if (outcome.status === 'failed') {
      logger.catch(outcome.error, { connectionId: reconnectConfig.id, action: 'reconnect' })
      showConnectionToast(TOAST_TYPE.ERROR, reconnectConfig)
      throw outcome.error
    }

    await saveConnectionConfigs()
    await loadSavedConnections()
    showConnectionToast(TOAST_TYPE.SUCCESS, reconnectConfig)
    return true
  }

  const handleEdit = async (connection: ConnectionConfig, onOpenDialog?: () => void) => {
    const session = getSessionByConnectionId(connection.id)
    if (session) {
      try {
        await protocolApi.disconnect(session.sessionId)
        removeSession(session.sessionId)
      } catch (err) {
        logger.catch(err, { action: 'edit-disconnect', connectionId: connection.id })
      }
    }
    setEditConfig(connection)
    onOpenDialog?.()
  }

  return {
    editConfig,
    setEditConfig,
    reconnectConfig,
    setReconnectConfig,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    connectionToDelete,
    setConnectionToDelete,
    confirmOpen,
    handleConfirm,
    handleCancel,
    title,
    message,
    handleSaveConnection,
    handleDisconnect,
    handleDelete,
    handleConfirmDelete,
    handleReconnect,
    handleReconnectSubmit,
    handleEdit,
    cancelConnect,
    cancelLatestConnect,
  }
}
