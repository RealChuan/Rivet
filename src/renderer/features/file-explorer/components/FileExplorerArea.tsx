import type React from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { TransferConflictDialog } from '@renderer/features/transfer/components/TransferConflictDialog.js'
import FileExplorerBreadcrumb from './FileExplorerBreadcrumb.js'
import FileExplorerList from './FileExplorerList.js'
import FileExplorerToolbar from './FileExplorerToolbar.js'

interface FileExplorerAreaProps {
  sessionId: string
}

export const FileExplorerArea: React.FC<FileExplorerAreaProps> = ({ sessionId }) => {
  const { t } = useTranslation()
  const sessions = useSessionStore(state => state.sessions)
  const activeSession = sessions.find(s => s.sessionId === sessionId)

  if (!activeSession?.isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg">
        <div className="text-center p-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-hover flex items-center justify-center">
            <svg className="w-5 h-5 stroke-text-muted stroke-[1.5]" viewBox="0 0 24 24" fill="none">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="text-sm text-text-muted mb-1">
            {activeSession ? t('fileExplorerList.disconnected') : t('connection.noConnections')}
          </p>
          <p className="text-xs text-text-muted opacity-70">
            {activeSession
              ? t('fileExplorerList.reconnectHint')
              : t('connection.newConnectionHint')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-bg overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-bg shrink-0">
        <FileExplorerBreadcrumb
          path={activeSession.currentPath}
          sessionId={activeSession.sessionId}
        />
        <FileExplorerToolbar sessionId={activeSession.sessionId} />
      </div>
      <div className="flex-1 overflow-hidden bg-bg">
        <FileExplorerList
          sessionId={activeSession.sessionId}
          currentPath={activeSession.currentPath}
        />
      </div>
      <TransferConflictDialog />
    </div>
  )
}

export default FileExplorerArea
