import { Home, ChevronRight } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { cn } from '@renderer/utils/index.js'
import { ROOT_PATH } from '@shared/constants/index.js'

interface FileExplorerBreadcrumbProps {
  path: string
  sessionId: string
  onNavigate?: (path: string) => void
}

export const FileExplorerBreadcrumb: React.FC<FileExplorerBreadcrumbProps> = ({
  path,
  sessionId,
  onNavigate,
}) => {
  const { t } = useTranslation()
  const updateCurrentPath = useSessionStore(state => state.updateCurrentPath)
  const refreshCurrentDirectory = useSessionStore(state => state.refreshCurrentDirectory)

  const pathParts = path.split('/').filter(Boolean)

  const handleNavigate = async (targetPath: string) => {
    if (onNavigate) {
      onNavigate(targetPath)
    } else {
      updateCurrentPath(sessionId, targetPath)
      await refreshCurrentDirectory(sessionId)
    }
  }

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto flex-1">
      <button
        onClick={() => void handleNavigate(ROOT_PATH)}
        aria-label={t('fileExplorerList.parentDirectory')}
        className={`
          flex items-center gap-1 px-2 py-1 rounded text-text
          bg-transparent border-none cursor-pointer whitespace-nowrap font-medium
          hover:bg-hover transition-colors
          focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
        `}
      >
        <Home className="w-3.5 h-3.5 stroke-accent stroke-2" />/
      </button>
      {pathParts.map((part, index) => {
        const fullPath = '/' + pathParts.slice(0, index + 1).join('/')
        const isLast = index === pathParts.length - 1

        return (
          <React.Fragment key={fullPath}>
            <ChevronRight className="w-3 h-3 stroke-text-muted stroke-2 shrink-0" />
            <button
              onClick={() => void handleNavigate(fullPath)}
              className={cn(
                'px-2 py-1 rounded bg-transparent border-none cursor-pointer whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2',
                isLast
                  ? 'text-text font-medium'
                  : 'text-text-muted font-normal hover:bg-hover hover:text-text'
              )}
            >
              <span className="max-w-40 overflow-hidden text-ellipsis">{part}</span>
            </button>
          </React.Fragment>
        )
      })}
    </nav>
  )
}

export default FileExplorerBreadcrumb
