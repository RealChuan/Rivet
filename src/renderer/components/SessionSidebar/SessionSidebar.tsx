import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../../stores/sessionStore'
import { useUiStore } from '../../stores/uiStore'
import SessionItem from './SessionItem'
import ConnectionDialog from '../dialogs/ConnectionDialog'
import { ConnectionConfig } from '@shared/types'

export const SessionSidebar: React.FC = () => {
  const { t } = useTranslation()
  const { sessions, activeSessionId, setActiveSession, addSession, removeSession } =
    useSessionStore()
  const { sidebarWidth, addToast } = useUiStore()
  const [connectionDialogOpen, setConnectionDialogOpen] = React.useState(false)

  const handleNewConnection = () => {
    setConnectionDialogOpen(true)
  }

  const handleSaveConnection = async (
    config: Omit<ConnectionConfig, 'id' | 'credentialId'>,
    password?: string,
    privateKey?: string
  ) => {
    try {
      await addSession(config, password, privateKey)
      addToast({ type: 'success', message: t('toast.connectionSuccess') })
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

  return (
    <div
      className="h-full flex flex-col"
      style={{
        width: sidebarWidth,
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
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
            <h1 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Rivet</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SFTP / WebDAV</p>
          </div>
        </div>
        <button
          onClick={handleNewConnection}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--accent)',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'background-color 0.15s',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
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

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sessions.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 12px',
                borderRadius: '50%',
                backgroundColor: 'var(--hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
              >
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              {t('sidebar.noConnections')}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {t('sidebar.newConnectionHint')}
            </p>
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            <div style={{ padding: '8px 16px 4px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {t('sidebar.connections')}
              </span>
            </div>
            {sessions.map(session => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onSelect={() => setActiveSession(session.id)}
                onDisconnect={() => handleDisconnect(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      <ConnectionDialog
        open={connectionDialogOpen}
        onClose={() => setConnectionDialogOpen(false)}
        onSave={handleSaveConnection}
      />
    </div>
  )
}

export default SessionSidebar
