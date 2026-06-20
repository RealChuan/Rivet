import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useActiveTaskGuard } from '@renderer/hooks/use-active-task-guard.js'
import { useUiStore } from '@renderer/stores/index.js'
import { logger } from '@renderer/utils/index.js'
import { SCHEME, TOAST_TYPE } from '@shared/constants/index.js'
import { type ConnectionConfig } from '@shared/types/index.js'
import { useConnectionStore } from '../stores/connection.js'
import { useSessionStore } from '../stores/session.js'
import { decryptPassword, encryptPassword } from '../utils/password-crypto.js'
import { useSessionConnect } from './use-session-connect.js'

export const useConnectionActions = () => {
  const { t } = useTranslation()
  const { connectSession, reconnectSession } = useSessionConnect()
  const removeSession = useSessionStore((state) => state.removeSession)
  const getSessionByConnectionId = useSessionStore((state) => state.getSessionByConnectionId)
  const connections = useConnectionStore((state) => state.connections)
  const addConnection = useConnectionStore((state) => state.addConnection)
  const updateConnection = useConnectionStore((state) => state.updateConnection)
  const deleteConnection = useConnectionStore((state) => state.deleteConnection)
  const saveConnectionConfigs = useConnectionStore((state) => state.saveConnectionConfigs)
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

  const handleSaveConnection = async (
    config: Omit<ConnectionConfig, 'id'> & { password?: string },
    onSuccess?: () => void,
  ) => {
    let encryptedPassword: string | undefined
    if (config.password) {
      try {
        encryptedPassword = await encryptPassword(config.password)
      } catch {
        addToast({ type: TOAST_TYPE.ERROR, message: t(($) => $.connectionDialog.encryptFailed) })
        throw new Error(t(($) => $.connectionDialog.encryptFailed))
      }
    }

    const connectionId = editConfig?.id ?? crypto.randomUUID()
    const fullConfig: ConnectionConfig = {
      id: connectionId,
      name: config.name,
      protocol: config.protocol,
      host: config.host,
      port: config.port,
      username: config.username,
      savePassword: config.savePassword ?? false,
      basePath: config.basePath ?? '',
      password: encryptedPassword ?? '',
      scheme: config.scheme ?? SCHEME.HTTPS,
      rejectUnauthorized: config.rejectUnauthorized ?? true,
    }

    const success = await connectSession(fullConfig)

    if (!success) {
      showConnectionToast(TOAST_TYPE.ERROR, config)
      throw new Error(t(($) => $.connectionDialog.connectFailed))
    }

    if (editConfig) {
      updateConnection(fullConfig)
    } else {
      addConnection(fullConfig)
    }
    await saveConnectionConfigs()
    showConnectionToast(TOAST_TYPE.SUCCESS, config)
    onSuccess?.()
    setEditConfig(null)
  }

  const handleDisconnect = (connectionId: string) => {
    const connection = connections.find((c) => c.id === connectionId)
    const session = getSessionByConnectionId(connectionId)

    const doDisconnect = async () => {
      try {
        if (session) {
          await window.electronAPI.protocol.disconnect(session.sessionId)
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
        await window.electronAPI.protocol.disconnect(session.sessionId)
        removeSession(session.sessionId)
      }
      await deleteConnection(connectionToDelete)
      addToast({ type: TOAST_TYPE.INFO, message: t(($) => $.toast.deleteConnectionSuccess) })
    } catch (error) {
      logger.catch(error, { connectionId: connectionToDelete, action: 'delete-connection' })
      addToast({
        type: TOAST_TYPE.ERROR,
        message: t(($) => $.toast.deleteFailed),
      })
    } finally {
      setDeleteConfirmOpen(false)
      setConnectionToDelete(null)
    }
  }

  const handleReconnect = async (connection: ConnectionConfig, onOpenDialog?: () => void) => {
    if (connection.password) {
      try {
        await decryptPassword(connection.password)
        const success = await reconnectSession(connection.id, {
          password: connection.password,
        })
        if (success) {
          showConnectionToast(TOAST_TYPE.SUCCESS, connection)
          return
        }
        // 连接失败，打开重连对话框让用户重新输入密码
      } catch (error) {
        logger.catch(error, { action: 'decrypt-password' })
        addToast({
          type: TOAST_TYPE.ERROR,
          message: t(($) => $.connectionDialog.decryptFailed),
        })
      }
    }
    setReconnectConfig(connection)
    onOpenDialog?.()
  }

  const handleReconnectSubmit = async (
    config: Omit<ConnectionConfig, 'id'> & { password?: string },
  ) => {
    if (!reconnectConfig) return
    try {
      let encryptedPassword: string | undefined

      if (config.password) {
        try {
          encryptedPassword = await encryptPassword(config.password)
        } catch {
          addToast({ type: TOAST_TYPE.ERROR, message: t(($) => $.connectionDialog.encryptFailed) })
          throw new Error(t(($) => $.connectionDialog.encryptFailed))
        }
      }

      const passwordConfig: { password?: string; savePassword?: boolean } = {}
      if (config.savePassword) {
        passwordConfig.savePassword = true
      }
      if (encryptedPassword) {
        passwordConfig.password = encryptedPassword
      }

      const success = await reconnectSession(reconnectConfig.id, passwordConfig)
      if (success) {
        // 连接成功后更新连接配置并持久化到磁盘
        const updatedConfig: ConnectionConfig = {
          ...reconnectConfig,
          savePassword: config.savePassword ?? false,
          password: encryptedPassword ?? '',
        }
        updateConnection(updatedConfig)
        await saveConnectionConfigs()
        showConnectionToast(TOAST_TYPE.SUCCESS, reconnectConfig)
      }
    } catch (error) {
      logger.catch(error, { connectionId: reconnectConfig?.id, action: 'reconnect' })
      showConnectionToast(TOAST_TYPE.ERROR, reconnectConfig)
      throw error
    }
  }

  const handleEdit = async (connection: ConnectionConfig, onOpenDialog?: () => void) => {
    const session = getSessionByConnectionId(connection.id)
    if (session) {
      try {
        await window.electronAPI.protocol.disconnect(session.sessionId)
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
  }
}
