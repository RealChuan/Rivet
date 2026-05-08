import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../../stores/sessionStore'
import FileArea from './FileArea'

export const FileAreaContainer: React.FC = () => {
  const { t } = useTranslation()
  const { sessions, activeSessionId } = useSessionStore()

  if (sessions.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg)',
        }}
      >
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 16px',
              borderRadius: '12px',
              backgroundColor: 'var(--hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
            >
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3
            style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', marginBottom: '6px' }}
          >
            {t('sidebar.noConnections')}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {t('sidebar.newConnectionHint')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {sessions.map(session => (
        <div
          key={session.id}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: session.id === activeSessionId ? 'flex' : 'none',
          }}
        >
          <FileArea sessionId={session.id} />
        </div>
      ))}
    </div>
  )
}

export default FileAreaContainer
