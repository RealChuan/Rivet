import React from 'react'
import { useSessionStore } from '@renderer/features/session/stores/session.js'

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
        onClick={() => void handleNavigate('/')}
        className={`
          flex items-center gap-1 px-2 py-1 rounded text-text
          bg-transparent border-none cursor-pointer whitespace-nowrap font-medium
          hover:bg-hover transition-colors
        `}
      >
        <svg className="w-3.5 h-3.5 stroke-accent stroke-2" viewBox="0 0 24 24" fill="none">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        /
      </button>
      {pathParts.map((part, index) => {
        const fullPath = '/' + pathParts.slice(0, index + 1).join('/')

        return (
          <React.Fragment key={fullPath}>
            <svg
              className="w-3 h-3 stroke-text-muted stroke-2 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <button
              onClick={() => void handleNavigate(fullPath)}
              className={`
                px-2 py-1 rounded bg-transparent border-none cursor-pointer
                whitespace-nowrap text-text/70 font-normal
                hover:bg-hover hover:text-text transition-colors
              `}
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
