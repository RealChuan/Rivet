import type React from 'react'
import { RefreshCw, FolderPlus, Upload, FolderUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TextInputDialog from '@renderer/components/common/TextInputDialog.js'
import {
  useFolderCreation,
  useTransferDialog,
} from '@renderer/features/file-explorer/hooks/index.js'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { useClickOutside } from '@renderer/hooks/index.js'
import { useUiStore } from '@renderer/stores/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'
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
    aria-label={title}
    className={`
      p-1.5 rounded flex items-center justify-center
      border-none cursor-pointer transition-all duration-150
      focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
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

  const { openFilePicker, openFolderPicker } = useTransferDialog({
    sessionId,
    currentPath: session?.currentPath ?? '/',
  })

  const { handleCreateFolder } = useFolderCreation(sessionId)

  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)
  const [showUploadMenu, setShowUploadMenu] = useState(false)
  const uploadMenuRef = useRef<HTMLDivElement>(null)

  useClickOutside({
    ref: uploadMenuRef,
    enabled: showUploadMenu,
    event: 'click',
    onOutside: () => setShowUploadMenu(false),
  })

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
    await handleCreateFolder(session.currentPath, folderName)
  }

  return (
    <div className="flex items-center gap-0.5 ml-auto">
      <ToolButton onClick={() => void handleRefresh()} title={`${t('common.action.refresh')} (F5)`}>
        <RefreshCw className="w-4 h-4 stroke-current stroke-2" />
      </ToolButton>

      <ToolButton onClick={() => setNewFolderDialogOpen(true)} title={t('file.action.newFolder')}>
        <FolderPlus className="w-4 h-4 stroke-current stroke-2" />
      </ToolButton>

      <div ref={uploadMenuRef} className="relative">
        <ToolButton
          onClick={() => setShowUploadMenu(prev => !prev)}
          title={t('file.action.upload')}
        >
          <Upload className="w-4 h-4 stroke-current stroke-2" />
        </ToolButton>
        {showUploadMenu && (
          <div className="absolute right-0 top-full mt-1 bg-glass-bg backdrop-blur-xl rounded-md shadow-dropdown border border-border p-1 min-w-40 z-1000 animate-menu-in">
            <button
              className="w-full px-3 py-2 text-left text-xs text-text bg-transparent border-none rounded cursor-pointer flex items-center gap-2 hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
              onClick={() => {
                setShowUploadMenu(false)
                void openFilePicker()
              }}
            >
              <Upload className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t('file.action.uploadFiles')}
            </button>
            <button
              className="w-full px-3 py-2 text-left text-xs text-text bg-transparent border-none rounded cursor-pointer flex items-center gap-2 hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
              onClick={() => {
                setShowUploadMenu(false)
                void openFolderPicker()
              }}
            >
              <FolderUp className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t('file.action.uploadFolder')}
            </button>
          </div>
        )}
      </div>

      <TextInputDialog
        open={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        onSubmit={folderName => void handleNewFolder(folderName)}
        title={t('file.action.newFolder')}
        placeholder={t('textInputDialog.newFolderPlaceholder')}
        submitText={t('common.action.confirm')}
      />
    </div>
  )
}

export default FileExplorerToolbar
