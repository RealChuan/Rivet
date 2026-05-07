import React from 'react'
import { useTranslation } from 'react-i18next'

interface Session {
  id: string
  config: {
    name: string
    protocol: 'sftp' | 'webdav'
    host: string
  }
  currentPath: string
  isConnected: boolean
  isLoading: boolean
  error: string | null
}

interface SessionItemProps {
  session: Session
  isActive: boolean
  onSelect: () => void
  onDisconnect: () => void
  onReconnect: () => void
  onDelete: () => void
  onEdit: () => void
  style?: React.CSSProperties
}

export const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  onSelect,
  onDisconnect,
  onReconnect,
  onDelete,
  onEdit,
  style,
}) => {
  const { t } = useTranslation()
  const [showMenu, setShowMenu] = React.useState(false)

  const protocolIcon =
    session.config.protocol === 'sftp' ? (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ) : (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    )

  return (
    <div style={{ position: 'relative', ...style }}>
      <div
        onClick={onSelect}
        style={{
          margin: '4px 8px',
          padding: '10px 12px',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: isActive ? 'var(--selected)' : 'transparent',
          border: '1px solid var(--border)',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'var(--hover)'
        }}
        onMouseLeave={e => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div
            style={{
              color: session.isConnected ? '#4ec9b0' : '#f59e0b',
            }}
          >
            {session.isLoading ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                style={{ animation: 'spin 1s linear infinite' }}
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  opacity="0.25"
                />
                <path
                  d="M12 2a10 10 0 0110 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            ) : session.isConnected ? (
              protocolIcon
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            )}
          </div>
          <span
            style={{
              fontSize: '10px',
              padding: '1px 4px',
              borderRadius: '2px',
              backgroundColor:
                session.config.protocol === 'sftp'
                  ? 'rgba(59, 130, 246, 0.1)'
                  : 'rgba(139, 92, 246, 0.1)',
              color: session.config.protocol === 'sftp' ? '#3b82f6' : '#8b5cf6',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {session.config.protocol.toUpperCase()}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: isActive ? 'var(--accent)' : 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {session.config.name || session.config.host}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {session.config.host}
          </div>
        </div>
        <button
          onClick={e => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          style={{
            padding: '4px',
            borderRadius: '4px',
            flexShrink: 0,
            color: 'var(--text-muted)',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>

      {showMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setShowMenu(false)}
          />
          <div
            style={{
              position: 'absolute',
              right: '8px',
              top: '100%',
              marginTop: '4px',
              zIndex: 20,
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '4px',
              minWidth: '120px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
            className="animate-fadeIn"
          >
            {session.isConnected ? (
              <button
                onClick={e => {
                  e.stopPropagation()
                  onDisconnect()
                  setShowMenu(false)
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                {t('sidebar.disconnect')}
              </button>
            ) : (
              <button
                onClick={e => {
                  e.stopPropagation()
                  onReconnect()
                  setShowMenu(false)
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: '12px',
                  color: '#4ec9b0',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
                {t('sidebar.reconnect')}
              </button>
            )}
            <div
              style={{
                height: '1px',
                backgroundColor: 'var(--border)',
                margin: '4px 0',
              }}
            />
            <button
              onClick={e => {
                e.stopPropagation()
                onEdit()
                setShowMenu(false)
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                fontSize: '12px',
                color: 'var(--text)',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              {t('sidebar.edit')}
            </button>
            <div
              style={{
                height: '1px',
                backgroundColor: 'var(--border)',
                margin: '4px 0',
              }}
            />
            <button
              onClick={e => {
                e.stopPropagation()
                onDelete()
                setShowMenu(false)
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                fontSize: '12px',
                color: '#f14c4c',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              {t('sidebar.delete')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default SessionItem
