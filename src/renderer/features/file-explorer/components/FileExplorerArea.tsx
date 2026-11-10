import { Plug } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../../session/stores/session.js'
import { TransferConflictDialog } from '../../transfer/components/TransferConflictDialog.js'
import { useTransferActions } from '../../transfer/hooks/use-transfer-actions.js'
import { TransferActionsContext } from '../contexts/transfer-actions.js'
import { useNavigationHistory } from '../hooks/index.js'
import FileExplorerAddressBar from './FileExplorerAddressBar.js'
import FileExplorerFilter from './FileExplorerFilter.js'
import FileExplorerNavigation from './FileExplorerNavigation.js'
import FileExplorerToolbar from './FileExplorerToolbar.js'
import FileView from './FileView.js'

interface FileExplorerAreaProps {
  sessionId: string
}

export const FileExplorerArea = ({ sessionId }: FileExplorerAreaProps) => {
  const { t } = useTranslation()
  const sessions = useSessionStore((state) => state.sessions)
  const activeSession = sessions.find((s) => s.sessionId === sessionId)
  const transferActions = useTransferActions()
  const history = useNavigationHistory(
    sessionId,
    activeSession?.connectionId ?? '',
    activeSession?.currentPath ?? '/',
  )
  const currentPath = activeSession?.currentPath ?? ''
  // 过滤只对当前目录有意义：把路径一起存进来，切目录后渲染期自然读到空串，
  // 不需要 effect + setState 的重置。
  const [filterState, setFilterState] = useState({ path: currentPath, query: '' })
  const filterQuery = filterState.path === currentPath ? filterState.query : ''
  const setFilterQuery = (query: string) => {
    setFilterState({ path: currentPath, query })
  }

  if (!activeSession?.isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent">
        <div className="text-center p-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-hover border border-border flex items-center justify-center">
            <Plug className="w-5 h-5 stroke-text-muted stroke-[1.5]" />
          </div>
          <p className="text-sm text-text-muted mb-1">
            {activeSession
              ? t(($) => $.fileExplorerList.disconnected)
              : t(($) => $.connection.noConnections)}
          </p>
          <p className="text-xs text-text-muted opacity-70">
            {activeSession
              ? t(($) => $.fileExplorerList.reconnectHint)
              : t(($) => $.connection.newConnectionHint)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <TransferActionsContext value={transferActions}>
      <div className="flex-1 flex flex-col bg-transparent overflow-hidden">
        <div className="border-b border-border bg-transparent shrink-0">
          <div className="flex items-center gap-2 px-3 py-2">
            <FileExplorerNavigation
              canGoBack={history.canGoBack}
              canGoForward={history.canGoForward}
              onBack={history.goBack}
              onForward={history.goForward}
            />
            <FileExplorerAddressBar
              sessionId={activeSession.sessionId}
              currentPath={activeSession.currentPath}
            />
            <FileExplorerFilter value={filterQuery} onChange={setFilterQuery} />
          </div>
          <div className="flex items-center px-3 py-1.5 border-t border-border">
            <FileExplorerToolbar sessionId={activeSession.sessionId} />
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-transparent">
          <FileView
            sessionId={activeSession.sessionId}
            currentPath={activeSession.currentPath}
            filterQuery={filterQuery}
          />
        </div>
        <TransferConflictDialog />
      </div>
    </TransferActionsContext>
  )
}

export default FileExplorerArea
