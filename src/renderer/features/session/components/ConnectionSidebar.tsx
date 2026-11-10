import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SORT_ORDER, TOAST_TYPE } from '@shared/constants/index.js'
import type { ConnectionFormValues } from './ConnectionFormFields.js'
import { clipboardApi } from '../../../api/clipboard.js'
import ConfirmationDialog from '../../../components/common/ConfirmationDialog.js'
import { useUiStore } from '../../../stores/index.js'
import logger from '../../../utils/logger.js'
import { HostKeyVerificationDialog } from '../../host-key/index.js'
import { useConnectionActions } from '../hooks/use-connection-actions.js'
import { useSessionDisconnect } from '../hooks/use-session-disconnect.js'
import { useConnectionStore } from '../stores/connection.js'
import { useSessionStore } from '../stores/session.js'
import { parseConnectionAddress } from '../utils/parse-connection-address.js'
import ConnectionDialog from './ConnectionDialog.js'
import ConnectionList from './ConnectionList.js'
import SidebarHeader from './SidebarHeader.js'

export const ConnectionSidebar = () => {
  const { t } = useTranslation()
  const activeSessionId = useSessionStore((state) => state.activeSessionId)
  const setActiveSession = useSessionStore((state) => state.setActiveSession)
  const getSessionByConnectionId = useSessionStore((state) => state.getSessionByConnectionId)
  useSessionStore((state) => state.sessions) // Track sessions for loading state reactivity
  const connections = useConnectionStore((state) => state.connections)
  const closeConnectionDialog = useConnectionStore((state) => state.closeConnectionDialog)
  const setCloseConnectionDialog = useConnectionStore((state) => state.setCloseConnectionDialog)
  const sortOrder = useConnectionStore((state) => state.sortOrder)
  const setSortOrder = useConnectionStore((state) => state.setSortOrder)
  const sortConnections = useConnectionStore((state) => state.sortConnections)
  const reorderConnections = useConnectionStore((state) => state.reorderConnections)

  const handleSortClick = () => {
    const nextOrder: typeof sortOrder =
      sortOrder === SORT_ORDER.NONE
        ? SORT_ORDER.ASC
        : sortOrder === SORT_ORDER.ASC
          ? SORT_ORDER.DESC
          : SORT_ORDER.NONE

    if (nextOrder === SORT_ORDER.NONE) {
      void setSortOrder(nextOrder)
    } else {
      void sortConnections(nextOrder)
    }
  }
  const [connectionDialogOpen, setConnectionDialogOpen] = React.useState(false)
  /** 「粘贴地址」带出来的表单预填；引用稳定，对话框靠它重置表单。 */
  const [prefill, setPrefill] = useState<Partial<ConnectionFormValues> | null>(null)
  const addToast = useUiStore((state) => state.addToast)

  useSessionDisconnect()

  const {
    editConfig,
    setEditConfig,
    reconnectConfig,
    setReconnectConfig,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
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
  } = useConnectionActions()

  /* eslint-disable react-hooks/set-state-in-effect -- Reset state when parent signals dialog close */
  useEffect(() => {
    if (closeConnectionDialog) {
      setConnectionDialogOpen(false)
      setEditConfig(null)
      setCloseConnectionDialog(false)
    }
  }, [closeConnectionDialog, setEditConfig, setCloseConnectionDialog])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleNewConnection = () => {
    setPrefill(null)
    setConnectionDialogOpen(true)
  }

  /** 从剪贴板认一条连接地址；认不出来就明说，不弹一个空表单让用户猜。 */
  const handlePasteAddress = async () => {
    let text: string
    try {
      text = await clipboardApi.readText()
    } catch (error) {
      logger.catch(error, { action: 'read-clipboard' })
      addToast({ type: TOAST_TYPE.ERROR, message: t(($) => $.connection.pasteFailed) })
      return
    }

    const parsed = parseConnectionAddress(text)
    if (!parsed) {
      addToast({ type: TOAST_TYPE.ERROR, message: t(($) => $.connection.pasteInvalid) })
      return
    }

    setEditConfig(null)
    setReconnectConfig(null)
    setPrefill({
      protocol: parsed.protocol,
      host: parsed.host,
      port: parsed.port,
      username: parsed.username,
      ...(parsed.share === undefined ? {} : { share: parsed.share }),
      ...(parsed.basePath === undefined ? {} : { basePath: parsed.basePath }),
      ...(parsed.scheme === undefined ? {} : { scheme: parsed.scheme }),
    })
    setConnectionDialogOpen(true)
  }

  const wrappedHandleSaveConnection = async (
    config: Parameters<typeof handleSaveConnection>[0],
  ) => {
    await handleSaveConnection(config, () => setConnectionDialogOpen(false))
  }

  const wrappedHandleReconnect = async (connection: Parameters<typeof handleReconnect>[0]) => {
    await handleReconnect(connection, () => setConnectionDialogOpen(true))
  }

  const wrappedHandleEdit = async (connection: Parameters<typeof handleEdit>[0]) => {
    await handleEdit(connection, () => setConnectionDialogOpen(true))
  }

  return (
    <>
      <div className="h-full flex flex-col bg-transparent" data-testid="connection-page">
        <SidebarHeader
          onNewConnection={handleNewConnection}
          onPasteAddress={() => void handlePasteAddress()}
        />

        <div className="flex-1 overflow-hidden">
          <ConnectionList
            connections={connections}
            activeSessionId={activeSessionId ?? undefined}
            sortOrder={sortOrder}
            onSortClick={handleSortClick}
            onReorderConnections={(activeId, overId) => void reorderConnections(activeId, overId)}
            onSelectSession={setActiveSession}
            onDisconnect={(id) => void handleDisconnect(id)}
            onReconnect={(conn) => void wrappedHandleReconnect(conn)}
            onEdit={(conn) => void wrappedHandleEdit(conn)}
            onDelete={handleDelete}
            getSessionByConnectionId={getSessionByConnectionId}
          />
        </div>

        <ConnectionDialog
          open={connectionDialogOpen}
          onClose={() => {
            setConnectionDialogOpen(false)
            setReconnectConfig(null)
            setEditConfig(null)
            setPrefill(null)
          }}
          onSave={reconnectConfig ? handleReconnectSubmit : wrappedHandleSaveConnection}
          config={editConfig ?? reconnectConfig ?? undefined}
          prefill={prefill ?? undefined}
        />
        <ConfirmationDialog
          open={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false)
          }}
          onConfirm={() => handleConfirmDelete()}
          title={t(($) => $.confirmationDialog.deleteConnectionTitle)}
          message={t(($) => $.confirmationDialog.deleteConnectionMessage)}
          confirmText={t(($) => $.common.action.delete)}
          cancelText={t(($) => $.common.action.cancel)}
          type="danger"
        />
        <ConfirmationDialog
          open={confirmOpen}
          onClose={handleCancel}
          onConfirm={() => void handleConfirm()}
          title={title}
          message={message}
          confirmText={t(($) => $.common.action.confirm)}
          cancelText={t(($) => $.common.action.cancel)}
          type="warning"
        />
      </div>
      <HostKeyVerificationDialog />
    </>
  )
}

export default ConnectionSidebar
