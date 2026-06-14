import type React from 'react'
import { Plug } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { cn } from '@renderer/utils/index.js'
import FileExplorerArea from './FileExplorerArea.js'

export const FileExplorerContainer: React.FC = () => {
  const { t } = useTranslation()
  const sessions = useSessionStore(state => state.sessions)
  const activeSessionId = useSessionStore(state => state.activeSessionId)

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent">
        <div className="text-center p-8">
          <div
            className={`
              w-16 h-16 mx-auto mb-4 rounded-xl
              bg-hover border border-border flex items-center justify-center
            `}
          >
            <Plug className="w-7 h-7 stroke-text-muted stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-medium text-text mb-1.5">{t('connection.noConnections')}</h3>
          <p className="text-xs text-text-muted">{t('connection.newConnectionHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      {sessions.map(session => (
        <div
          key={session.sessionId}
          className={cn(
            'absolute top-0 left-0 right-0 bottom-0',
            session.sessionId === activeSessionId ? 'flex' : 'hidden'
          )}
        >
          <FileExplorerArea sessionId={session.sessionId} />
        </div>
      ))}
    </div>
  )
}

export default FileExplorerContainer
