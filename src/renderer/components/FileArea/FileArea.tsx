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
      <div className="flex-1 flex items-center justify-center bg-bg">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-hover flex items-center justify-center">
            <svg className="w-7 h-7 stroke-text-muted stroke-[1.5]" viewBox="0 0 24 24" fill="none">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-text mb-1.5">
            {activeSession ? t('fileList.disconnected') : t('sidebar.noConnections')}
          </h3>
          <p className="text-xs text-text-muted">
            {activeSession ? t('fileList.reconnectHint') : t('sidebar.newConnectionHint')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-bg overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-bg shrink-0">
        <Breadcrumb path={activeSession.currentPath} sessionId={activeSession.id} />
        <Toolbar sessionId={activeSession.id} />
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-bg">
        <div className="min-w-full h-full overflow-y-auto">
          <FileList sessionId={activeSession.id} currentPath={activeSession.currentPath} />
        </div>
      </div>
    </div>
  )
}

export default FileArea
