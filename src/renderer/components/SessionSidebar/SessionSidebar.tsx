import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../../stores/sessionStore.js'
import { useUiStore } from '../../stores/uiStore.js'
import SessionItem from './SessionItem.js'
import ConnectionDialog from '../dialogs/ConnectionDialog.js'
import ConfirmDialog from '../dialogs/ConfirmDialog.js'
import { ConnectionConfig } from '../../../shared/types.js'
import VirtualList from '../VirtualList.js'

export const SessionSidebar: React.FC = () => {
  const { t } = useTranslation()
  const {
    sessions,
    activeSessionId,
    setActiveSession,
    addSession,
    updateSession,
    removeSession,
    deleteSession,
    reconnectSession,
  } = useSessionStore()
  const { sidebarWidth, addToast } = useUiStore()
  const [connectionDialogOpen, setConnectionDialogOpen] = React.useState(false)
  const [reconnectConfig, setReconnectConfig] = React.useState<(typeof sessions)[0] | null>(null)
  const [editConfig, setEditConfig] = React.useState<(typeof sessions)[0] | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [sessionToDelete, setSessionToDelete] = React.useState<string | null>(null)

  const handleNewConnection = () => {
    setConnectionDialogOpen(true)
  }

  const handleSaveConnection = async (
    config: Omit<ConnectionConfig, 'id' | 'credentialId'>,
    password?: string,
    privateKey?: string
  ) => {
    try {
      if (editConfig) {
        await updateSession(editConfig.id, config, password, privateKey)
        addToast({ type: 'success', message: t('toast.connectionSuccess') })
      } else {
        await addSession(config, password, privateKey)
        addToast({ type: 'success', message: t('toast.connectionSuccess') })
      }
    } catch (error) {
      addToast({
        type: 'error',
        message: `${t('toast.connectionFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
      throw error
    }
  }

  const handleDisconnect = async (sessionId: string) => {
    try {
      await removeSession(sessionId)
      addToast({ type: 'info', message: t('toast.disconnectSuccess') })
    } catch (error) {
      addToast({
        type: 'error',
        message: `Disconnect failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  const handleDelete = (sessionId: string) => {
    setSessionToDelete(sessionId)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return
    try {
      await deleteSession(sessionToDelete)
      addToast({ type: 'info', message: t('toast.deleteConnectionSuccess') })
    } catch (error) {
      addToast({
        type: 'error',
        message: `Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setDeleteConfirmOpen(false)
      setSessionToDelete(null)
    }
  }

  const handleReconnect = async (session: (typeof sessions)[0]) => {
    if (session.password || session.privateKey) {
      try {
        await reconnectSession(session)
        addToast({ type: 'success', message: t('toast.connectionSuccess') })
        return
      } catch {
        /* empty */
      }
    }
    setReconnectConfig(session)
    setConnectionDialogOpen(true)
  }

  const handleReconnectSubmit = async (
    _config: Omit<ConnectionConfig, 'id' | 'credentialId'>,
    password?: string,
    privateKey?: string
  ) => {
    if (!reconnectConfig) return
    try {
      await reconnectSession(reconnectConfig, password, privateKey)
      addToast({ type: 'success', message: t('toast.connectionSuccess') })
    } catch (error) {
      addToast({
        type: 'error',
        message: `${t('toast.connectionFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
      throw error
    }
  }

  const handleEdit = (session: (typeof sessions)[0]) => {
    setEditConfig(session)
    setConnectionDialogOpen(true)
  }

  return (
    <div
      className="h-full flex flex-col border-r border-border"
      style={{ width: sidebarWidth, backgroundColor: 'var(--sidebar-bg)' }}
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2.5 mb-3.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-text">Rivet</h1>
            <p className="text-xs text-text-muted">SFTP / WebDAV</p>
          </div>
        </div>
        <button
          onClick={handleNewConnection}
          className={`
            w-full px-3 py-2 rounded-md bg-accent text-white
            text-sm font-medium flex items-center justify-center gap-1.5
            transition-colors border-none cursor-pointer hover:bg-accent-hover
          `}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('sidebar.newConnection')}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="px-4 py-6 text-center h-full flex flex-col items-center justify-center">
            <div className="w-12 h-12 mb-3 rounded-full bg-hover flex items-center justify-center">
              <svg
                className="w-5 h-5 stroke-text-muted"
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="1.5"
              >
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <p className="text-xs text-text-muted mb-1">{t('sidebar.noConnections')}</p>
            <p className="text-xs text-text-muted">{t('sidebar.newConnectionHint')}</p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="px-4 pt-3.5 pb-2">
              <span className="text-sm font-semibold text-text-muted uppercase tracking-[0.5px]">
                {t('sidebar.connections')}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto min-h-50">
              <VirtualList
                items={sessions}
                itemHeight={72}
                width="100%"
                renderItem={(session, _index, style) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    onSelect={() => setActiveSession(session.id)}
                    onDisconnect={() => handleDisconnect(session.id)}
                    onReconnect={() => handleReconnect(session)}
                    onEdit={() => handleEdit(session)}
                    onDelete={() => handleDelete(session.id)}
                    style={style}
                  />
                )}
              />
            </div>
          </div>
        )}
      </div>

      <ConnectionDialog
        open={connectionDialogOpen}
        onClose={() => {
          setConnectionDialogOpen(false)
          setReconnectConfig(null)
          setEditConfig(null)
        }}
        onSave={reconnectConfig ? handleReconnectSubmit : handleSaveConnection}
        editConfig={editConfig?.config || reconnectConfig?.config}
        reconnectMode={!!reconnectConfig}
        savedPassword={editConfig?.password || reconnectConfig?.password}
        savedPrivateKey={editConfig?.privateKey || reconnectConfig?.privateKey}
        authMethod={editConfig?.authMethod || reconnectConfig?.authMethod}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false)
          setSessionToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
        title={t('dialog.deleteConnectionTitle')}
        message={t('dialog.deleteConnectionMessage')}
        confirmText={t('sidebar.delete')}
        cancelText={t('dialog.cancel')}
        type="danger"
      />
    </div>
  )
}

export default SessionSidebar
