import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@renderer/features/session/stores/sessionStore.js'
import { useUiStore } from '@renderer/stores/index.js'
import SessionItem from './SessionItem.js'
import ConnectionDialog from './ConnectionDialog.js'
import { HostKeyDialog } from '@renderer/features/host-key/index.js'
import ConfirmDialog from '@renderer/components/common/ConfirmDialog.js'
import { type ConnectionConfig } from '@shared/types/index.js'
import { toErrorMessage } from '@shared/utils/index.js'
import VirtualList from '@renderer/components/ui/VirtualList.js'

export const SessionSidebar: React.FC = () => {
  const { t } = useTranslation()
  const {
    connections,
    sessions,
    activeSessionId,
    setActiveSession,
    addConnection,
    updateConnection,
    removeConnection,
    deleteConnection,
    reconnectSession,
    getSessionByconnectionUuid,
  } = useSessionStore()
  const { sidebarWidth, addToast } = useUiStore()
  const [connectionDialogOpen, setConnectionDialogOpen] = React.useState(false)
  const [reconnectConfig, setReconnectConfig] = React.useState<ConnectionConfig | null>(null)
  const [editConfig, setEditConfig] = React.useState<ConnectionConfig | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [connectionToDelete, setConnectionToDelete] = React.useState<string | null>(null)

  // 监听会话断开事件
  React.useEffect(() => {
    const unsubscribe = window.electronAPI.protocol.onSessionDisconnected(event => {
      // 从 store 中移除会话
      void removeConnection(event.connectionUuid)

      // 显示 Toast 提示
      addToast({
        type: 'error',
        message: t('toast.connectionLost', {
          protocol: event.protocol.toUpperCase(),
          name: event.name,
        }),
      })
    })

    return unsubscribe
  }, [t, removeConnection, addToast])

  const handleNewConnection = () => {
    setConnectionDialogOpen(true)
  }

  const showConnectionToast = useCallback(
    (type: 'success' | 'error', config: { protocol: string; name: string }) => {
      addToast({
        type,
        message: t(`toast.connection${type === 'success' ? 'Success' : 'Failed'}`, {
          protocol: config.protocol.toUpperCase(),
          name: config.name,
        }),
      })
    },
    [addToast, t]
  )

  const handleSaveConnection = async (config: Omit<ConnectionConfig, 'connectionUuid'>) => {
    try {
      const fullConfig: ConnectionConfig = {
        ...config,
        connectionUuid: editConfig?.connectionUuid ?? '',
      }
      if (editConfig) {
        await updateConnection(editConfig.connectionUuid, config)
      } else {
        await addConnection(config)
      }
      showConnectionToast('success', fullConfig)
    } catch (error) {
      showConnectionToast('error', config)
      throw error
    }
  }

  const handleDisconnect = useCallback(
    (connectionUuid: string) => {
      const connection = connections.find(c => c.connectionUuid === connectionUuid)
      try {
        void removeConnection(connectionUuid)
        addToast({
          type: 'info',
          message: t('toast.disconnectSuccess', {
            protocol: connection ? connection.protocol.toUpperCase() : 'Unknown',
            name: connection?.name ?? 'Unknown',
          }),
        })
      } catch (_error) {
        addToast({
          type: 'error',
          message: t('toast.disconnectFailed', {
            protocol: connection ? connection.protocol.toUpperCase() : 'Unknown',
            name: connection?.name ?? 'Unknown',
          }),
        })
      }
    },
    [connections, removeConnection, addToast, t]
  )

  const handleDelete = useCallback((connectionUuid: string) => {
    setConnectionToDelete(connectionUuid)
    setDeleteConfirmOpen(true)
  }, [])

  const handleConfirmDelete = () => {
    if (!connectionToDelete) return
    try {
      void deleteConnection(connectionToDelete)
      addToast({ type: 'info', message: t('toast.deleteConnectionSuccess') })
    } catch (error) {
      addToast({
        type: 'error',
        message: `Delete failed: ${toErrorMessage(error) || 'Unknown error'}`,
      })
    } finally {
      setDeleteConfirmOpen(false)
      setConnectionToDelete(null)
    }
  }

  const handleReconnect = useCallback(
    async (connection: ConnectionConfig) => {
      if (connection.password) {
        try {
          await reconnectSession(connection.connectionUuid)
          showConnectionToast('success', connection)
          return
        } catch {
          /* empty */
        }
      }
      setReconnectConfig(connection)
      setConnectionDialogOpen(true)
    },
    [reconnectSession, showConnectionToast]
  )

  const handleReconnectSubmit = async (config: Omit<ConnectionConfig, 'connectionUuid'>) => {
    if (!reconnectConfig) return
    try {
      const passwordConfig: Partial<{ password?: string; savePassword?: boolean }> = {}
      if (config.password) {
        passwordConfig.password = config.password
      }
      if (config.savePassword !== undefined) {
        passwordConfig.savePassword = config.savePassword
      }
      await reconnectSession(reconnectConfig.connectionUuid, passwordConfig)
      showConnectionToast('success', reconnectConfig)
    } catch (error) {
      showConnectionToast('error', reconnectConfig)
      throw error
    }
  }

  const handleEdit = useCallback((connection: ConnectionConfig) => {
    setEditConfig(connection)
    setConnectionDialogOpen(true)
  }, [])

  const sessionsHash = useMemo(() => {
    return JSON.stringify(sessions)
  }, [sessions])

  const renderSessionItem = useCallback(
    (connection: ConnectionConfig, _index: number, style: React.CSSProperties) => {
      const session = getSessionByconnectionUuid(connection.connectionUuid)
      return (
        <SessionItem
          connection={connection}
          session={session}
          isActive={session?.sessionId === activeSessionId}
          onSelect={() => session && setActiveSession(session.sessionId)}
          onDisconnect={() => void handleDisconnect(connection.connectionUuid)}
          onReconnect={() => void handleReconnect(connection)}
          onEdit={() => void handleEdit(connection)}
          onDelete={() => handleDelete(connection.connectionUuid)}
          style={style}
        />
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeSessionId,
      getSessionByconnectionUuid,
      setActiveSession,
      handleDisconnect,
      handleReconnect,
      handleEdit,
      handleDelete,
      sessionsHash,
    ]
  )

  return (
    <>
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
          {connections.length === 0 ? (
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
              <div className="flex-1 min-h-50">
                <VirtualList
                  items={connections}
                  itemHeight={72}
                  width="100%"
                  renderItem={renderSessionItem}
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
          config={editConfig ?? reconnectConfig ?? undefined}
        />
        <ConfirmDialog
          open={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false)
            setConnectionToDelete(null)
          }}
          onConfirm={() => void handleConfirmDelete()}
          title={t('dialog.deleteConnectionTitle')}
          message={t('dialog.deleteConnectionMessage')}
          confirmText={t('sidebar.delete')}
          cancelText={t('dialog.cancel')}
          type="danger"
        />
      </div>
      <HostKeyDialog />
    </>
  )
}

export default SessionSidebar
