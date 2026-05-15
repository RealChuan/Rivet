import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@renderer/features/session/stores/sessionStore.js'
import { useUiStore } from '@renderer/stores/index.js'
import InputDialog from '@renderer/components/common/InputDialog.js'
import { toErrorMessage, fireAndForget } from '@shared/utils/index.js'

interface ToolbarProps {
  sessionId: string
}

export const Toolbar: React.FC<ToolbarProps> = ({ sessionId }) => {
  const { t } = useTranslation()
  const { refreshCurrentDirectory, sessions } = useSessionStore()
  const { addToast } = useUiStore()

  const session = sessions.find(s => s.sessionId === sessionId)

  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)

  const handleRefresh = async () => {
    try {
      await refreshCurrentDirectory(sessionId)
    } catch (error) {
      addToast({
        type: 'error',
        message: `Refresh failed: ${toErrorMessage(error) || 'Unknown error'}`,
      })
    }
  }

  const handleNewFolder = async (folderName: string) => {
    if (!session) return
    const newFolderPath =
      session.currentPath === '/' ? `/${folderName}` : `${session.currentPath}/${folderName}`

    try {
      await window.electronAPI.protocol.mkdir(sessionId, newFolderPath)
      addToast({ type: 'success', message: t('toast.createFolderSuccess') })
      await refreshCurrentDirectory(sessionId)
    } catch (error) {
      addToast({
        type: 'error',
        message: `${t('toast.createFolderFailed')}: ${toErrorMessage(error) || 'Unknown error'}`,
      })
    }
  }

  const ToolButton = ({
    onClick,
    title,
    isActive = false,
    children,
  }: {
    onClick: () => void
    title: string
    isActive?: boolean
    children: React.ReactNode
  }) => (
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

  return (
    <div className="flex items-center gap-0.5 ml-auto">
      <ToolButton
        onClick={() => fireAndForget(handleRefresh(), 'Failed to refresh directory')}
        title={`${t('toolbar.refresh')} (F5)`}
      >
        <svg className="w-4 h-4 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
        </svg>
      </ToolButton>

      <ToolButton onClick={() => setNewFolderDialogOpen(true)} title={t('toolbar.newFolder')}>
        <svg className="w-4 h-4 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      </ToolButton>

      <InputDialog
        open={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        onSubmit={folderName =>
          fireAndForget(handleNewFolder(folderName), 'Failed to create folder')
        }
        title={t('dialog.newFolder.title')}
        placeholder={t('dialog.newFolder.placeholder')}
        submitText={t('dialog.ok')}
      />
    </div>
  )
}

export default Toolbar
