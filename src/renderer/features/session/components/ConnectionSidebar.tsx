import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmationDialog from '@renderer/components/common/ConfirmationDialog.js'
import { HostKeyVerificationDialog } from '@renderer/features/host-key/index.js'
import { useConnectionActions } from '@renderer/features/session/hooks/use-connection-actions.js'
import { useSessionDisconnect } from '@renderer/features/session/hooks/use-session-disconnect.js'
import { useConnectionStore } from '@renderer/features/session/stores/connection.js'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { SORT_ORDER } from '@shared/constants/index.js'
import ConnectionDialog from './ConnectionDialog.js'
import ConnectionList from './ConnectionList.js'
import SidebarHeader from './SidebarHeader.js'

export const ConnectionSidebar: React.FC = () => {
  const { t } = useTranslation()
  const activeSessionId = useSessionStore(state => state.activeSessionId)
  const setActiveSession = useSessionStore(state => state.setActiveSession)
  const getSessionByConnectionId = useSessionStore(state => state.getSessionByConnectionId)
  const connections = useConnectionStore(state => state.connections)
  const closeConnectionDialog = useConnectionStore(state => state.closeConnectionDialog)
  const setCloseConnectionDialog = useConnectionStore(state => state.setCloseConnectionDialog)
  const sortOrder = useConnectionStore(state => state.sortOrder)
  const setSortOrder = useConnectionStore(state => state.setSortOrder)
  const sortConnections = useConnectionStore(state => state.sortConnections)
  const reorderConnections = useConnectionStore(state => state.reorderConnections)

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

  const [prevCloseDialog, setPrevCloseDialog] = useState(closeConnectionDialog)
  if (closeConnectionDialog && closeConnectionDialog !== prevCloseDialog) {
    setPrevCloseDialog(closeConnectionDialog)
    setConnectionDialogOpen(false)
    setEditConfig(null)
    setCloseConnectionDialog(false)
  }

  const handleNewConnection = () => {
    setConnectionDialogOpen(true)
  }

  const wrappedHandleSaveConnection = async (
    config: Parameters<typeof handleSaveConnection>[0]
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
      <div className="h-full flex flex-col bg-bg">
        <SidebarHeader onNewConnection={handleNewConnection} />

        <div className="flex-1 overflow-hidden">
          <ConnectionList
            connections={connections}
            activeSessionId={activeSessionId ?? undefined}
            sortOrder={sortOrder}
            onSortClick={handleSortClick}
            onReorderConnections={(activeId, overId) => void reorderConnections(activeId, overId)}
            onSelectSession={setActiveSession}
            onDisconnect={id => void handleDisconnect(id)}
            onReconnect={conn => void wrappedHandleReconnect(conn)}
            onEdit={conn => void wrappedHandleEdit(conn)}
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
          }}
          onSave={reconnectConfig ? handleReconnectSubmit : wrappedHandleSaveConnection}
          config={editConfig ?? reconnectConfig ?? undefined}
        />
        <ConfirmationDialog
          open={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false)
          }}
          onConfirm={() => handleConfirmDelete()}
          title={t('confirmationDialog.deleteConnectionTitle')}
          message={t('confirmationDialog.deleteConnectionMessage')}
          confirmText={t('common.action.delete')}
          cancelText={t('common.action.cancel')}
          type="danger"
        />
        <ConfirmationDialog
          open={confirmOpen}
          onClose={handleCancel}
          onConfirm={() => void handleConfirm()}
          title={title}
          message={message}
          confirmText={t('common.action.confirm')}
          cancelText={t('common.action.cancel')}
          type="warning"
        />
      </div>
      <HostKeyVerificationDialog />
    </>
  )
}

export default ConnectionSidebar
