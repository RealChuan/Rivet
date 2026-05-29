import type React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import TextInputDialog from '@renderer/components/common/TextInputDialog.js'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { useUiStore } from '@renderer/stores/index.js'
import { ROOT_PATH, TOAST_TYPE } from '@shared/constants/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'

interface FileExplorerToolbarProps {
  sessionId: string
}

interface ToolButtonProps {
  onClick: () => void
  title: string
  isActive?: boolean
  children: React.ReactNode
}

const ToolButton = ({ onClick, title, isActive = false, children }: ToolButtonProps) => (
  <button
    onClick={onClick}
    title={title}
    className={`
      p-1.5 rounded flex items-center justify-center
      border-none cursor-pointer transition-all duration-150
      ${isActive ? 'text-accent bg-hover' : 'text-text hover:bg-hover'}
    `}
  >
    {children}
  </button>
)

export const FileExplorerToolbar: React.FC<FileExplorerToolbarProps> = ({ sessionId }) => {
  const { t } = useTranslation()
  const refreshCurrentDirectory = useSessionStore(state => state.refreshCurrentDirectory)
  const sessions = useSessionStore(state => state.sessions)
  const addToast = useUiStore(state => state.addToast)

  const session = sessions.find(s => s.sessionId === sessionId)

  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)

  const handleRefresh = async () => {
    try {
      await refreshCurrentDirectory(sessionId)
    } catch (error) {
      addToast({
        type: TOAST_TYPE.ERROR,
        message: `${t('toast.refreshFailed')}: ${formatErrorMessage(error) || t('error.unknown')}`,
      })
    }
  }

  const handleNewFolder = async (folderName: string) => {
    if (!session) return
    const newFolderPath =
      session.currentPath === ROOT_PATH ? `/${folderName}` : `${session.currentPath}/${folderName}`

    try {
      await window.electronAPI.protocol.mkdir(sessionId, newFolderPath)
      addToast({ type: TOAST_TYPE.SUCCESS, message: t('toast.createFolderSuccess') })
      await refreshCurrentDirectory(sessionId)
    } catch (error) {
      addToast({
        type: TOAST_TYPE.ERROR,
        message: `${t('toast.createFolderFailed')}: ${formatErrorMessage(error) || t('error.unknown')}`,
      })
    }
  }

  return (
    <div className="flex items-center gap-0.5 ml-auto">
      <ToolButton onClick={() => void handleRefresh()} title={`${t('action.refresh')} (F5)`}>
        <svg className="w-4 h-4 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
        </svg>
      </ToolButton>

      <ToolButton onClick={() => setNewFolderDialogOpen(true)} title={t('file.action.newFolder')}>
        <svg className="w-4 h-4 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      </ToolButton>

      <TextInputDialog
        open={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        onSubmit={folderName => void handleNewFolder(folderName)}
        title={t('file.action.newFolder')}
        placeholder={t('textInputDialog.newFolderPlaceholder')}
        submitText={t('action.confirm')}
      />
    </div>
  )
}

export default FileExplorerToolbar
