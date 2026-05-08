import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../../stores/sessionStore'
import FileList from './FileList'
import Breadcrumb from './Breadcrumb'
import Toolbar from './Toolbar'

interface FileAreaProps {
  sessionId: string
}

export const FileArea: React.FC<FileAreaProps> = ({ sessionId }) => {
  const { t } = useTranslation()
  const { sessions } = useSessionStore()
  const activeSession = sessions.find(s => s.id === sessionId)

  if (!activeSession || !activeSession.isConnected) {
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
            {activeSession ? t('fileList.disconnected') : t('sidebar.noConnections')}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {activeSession ? t('fileList.reconnectHint') : t('sidebar.newConnectionHint')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg)',
          flexShrink: 0,
        }}
      >
        <Breadcrumb path={activeSession.currentPath} sessionId={activeSession.id} />
        <Toolbar sessionId={activeSession.id} />
      </div>
      <div
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          backgroundColor: 'var(--bg)',
        }}
      >
        <div
          style={{
            minWidth: '100%',
            overflowY: 'auto',
            height: '100%',
          }}
        >
          <FileList sessionId={activeSession.id} currentPath={activeSession.currentPath} />
        </div>
      </div>
    </div>
  )
}

export default FileArea
