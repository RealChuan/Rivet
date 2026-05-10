import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../../stores/sessionStore.js'
import { useUiStore } from '../../stores/uiStore.js'
import { useTransferQueue } from '../../hooks/useTransferQueue.js'
import InputDialog from '../dialogs/InputDialog.js'

interface ToolbarProps {
  sessionId: string
}

export const Toolbar: React.FC<ToolbarProps> = ({ sessionId }) => {
  const { t } = useTranslation()
  const { refreshCurrentDirectory, sessions } = useSessionStore()
  const { addToast } = useUiStore()
  const { upload } = useTransferQueue()

  const session = sessions.find(s => s.id === sessionId)

  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)

  const handleRefresh = async () => {
    try {
      await refreshCurrentDirectory(sessionId)
    } catch (error) {
      addToast({
        type: 'error',
        message: `Refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        message: `${t('toast.createFolderFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  const handleUpload = async () => {
    if (!session) return
    try {
      const result = await window.electronAPI.common.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
      })

      if (result && !result.canceled && result.filePaths.length > 0) {
        for (const filePath of result.filePaths) {
          const fileName = filePath.split(/[/\\]/).pop() || 'file'
          const remotePath =
            session.currentPath === '/' ? `/${fileName}` : `${session.currentPath}/${fileName}`
          await upload(filePath, remotePath)
        }
      }
    } catch (error) {
      addToast({
        type: 'error',
        message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      <ToolButton onClick={handleRefresh} title={`${t('toolbar.refresh')} (F5)`}>
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

      <ToolButton onClick={handleUpload} title={t('toolbar.upload')}>
        <svg className="w-4 h-4 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </ToolButton>

      <InputDialog
        open={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        onSubmit={handleNewFolder}
        title={t('dialog.newFolder.title')}
        placeholder={t('dialog.newFolder.placeholder')}
        submitText={t('dialog.ok')}
      />
    </div>
  )
}

export default Toolbar
