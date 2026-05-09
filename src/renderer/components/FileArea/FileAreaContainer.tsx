import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../../stores/sessionStore'
import FileArea from './FileArea'

export const FileAreaContainer: React.FC = () => {
  const { t } = useTranslation()
  const { sessions, activeSessionId } = useSessionStore()

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg">
        <div className="text-center p-8">
          <div
            className={`
              w-16 h-16 mx-auto mb-4 rounded-xl
              bg-hover flex items-center justify-center
            `}
          >
            <svg className="w-7 h-7 stroke-text-muted stroke-[1.5]" viewBox="0 0 24 24" fill="none">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-text mb-1.5">{t('sidebar.noConnections')}</h3>
          <p className="text-xs text-text-muted">{t('sidebar.newConnectionHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      {sessions.map(session => (
        <div
          key={session.id}
          className={`
            absolute top-0 left-0 right-0 bottom-0
            ${session.id === activeSessionId ? 'flex' : 'hidden'}
          `}
        >
          <FileArea sessionId={session.id} />
        </div>
      ))}
    </div>
  )
}

export default FileAreaContainer
