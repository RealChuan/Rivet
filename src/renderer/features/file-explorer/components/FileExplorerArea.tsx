import type React from 'react'
import { Plug } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { TransferConflictDialog } from '@renderer/features/transfer/components/TransferConflictDialog.js'
import { useTransferActions } from '@renderer/features/transfer/hooks/use-transfer-actions.js'
import { TransferActionsContext } from '../contexts/transfer-actions.js'
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
  const transferActions = useTransferActions()

  if (!activeSession?.isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent">
        <div className="text-center p-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-hover border border-border flex items-center justify-center">
            <Plug className="w-5 h-5 stroke-text-muted stroke-[1.5]" />
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
    <TransferActionsContext value={transferActions}>
      <div className="flex-1 flex flex-col bg-transparent overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-transparent shrink-0">
          <FileExplorerBreadcrumb
            path={activeSession.currentPath}
            sessionId={activeSession.sessionId}
          />
          <div className="shrink-0 w-px h-4 bg-border" />
          <FileExplorerToolbar sessionId={activeSession.sessionId} />
        </div>
        <div className="flex-1 overflow-hidden bg-transparent">
          <FileExplorerList
            sessionId={activeSession.sessionId}
            currentPath={activeSession.currentPath}
          />
        </div>
        <TransferConflictDialog />
      </div>
    </TransferActionsContext>
  )
}

export default FileExplorerArea
