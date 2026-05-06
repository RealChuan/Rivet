import type React from 'react'
import { RefreshCw, FolderPlus, Upload, FolderUp, LayoutGrid, List } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FILE_VIEW_MODE, TOAST_TYPE } from '@shared/constants/index.js'
import TextInputDialog from '../../../components/common/TextInputDialog.js'
import { useClickOutside } from '../../../hooks/index.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import { useSessionStore } from '../../session/stores/session.js'
import { useDirectoryInvalidation, useFolderCreation, useTransferDialog } from '../hooks/index.js'

interface FileExplorerToolbarProps {
  sessionId: string
}

interface ToolButtonProps {
  onClick: () => void
  title: string
  isActive?: boolean
  testId?: string
  children: React.ReactNode
}

const ToolButton = ({ onClick, title, isActive = false, testId, children }: ToolButtonProps) => (
  <button
    {...(testId ? { 'data-testid': testId } : {})}
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

export const FileExplorerToolbar = ({ sessionId }: FileExplorerToolbarProps) => {
  const { t } = useTranslation()
  const { invalidateSession } = useDirectoryInvalidation()
  const sessions = useSessionStore((state) => state.sessions)
  const addToast = useUiStore((state) => state.addToast)
  const session = sessions.find((s) => s.sessionId === sessionId)
  const fileViewMode = useUiStore((state) => state.fileViewModes[sessionId] ?? FILE_VIEW_MODE.LIST)
  const setFileViewMode = useUiStore((state) => state.setFileViewMode)

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
      await invalidateSession(sessionId)
    } catch (error) {
      addToast({
        type: TOAST_TYPE.ERROR,
        message: `${t(($) => $.toast.refreshFailed)}: ${resolveErrorMessage(t, error)}`,
      })
    }
  }

  const handleNewFolder = async (folderName: string) => {
    if (!session) return
    await handleCreateFolder(session.currentPath, folderName)
  }

  return (
    <div className="flex items-center gap-0.5 ml-auto">
      <ToolButton
        onClick={() => void handleRefresh()}
        title={`${t(($) => $.common.action.refresh)} (F5)`}
        testId="toolbar-refresh"
      >
        <RefreshCw className="w-4 h-4 stroke-current stroke-2" />
      </ToolButton>

      <ToolButton
        onClick={() => setFileViewMode(sessionId, FILE_VIEW_MODE.LIST)}
        title={t(($) => $.fileExplorerList.viewList)}
        isActive={fileViewMode === FILE_VIEW_MODE.LIST}
        testId="view-mode-list"
      >
        <List className="w-4 h-4 stroke-current stroke-2" />
      </ToolButton>

      <ToolButton
        onClick={() => setFileViewMode(sessionId, FILE_VIEW_MODE.GRID)}
        title={t(($) => $.fileExplorerList.viewGrid)}
        isActive={fileViewMode === FILE_VIEW_MODE.GRID}
        testId="view-mode-grid"
      >
        <LayoutGrid className="w-4 h-4 stroke-current stroke-2" />
      </ToolButton>

      <ToolButton
        onClick={() => setNewFolderDialogOpen(true)}
        title={t(($) => $.file.action.newFolder)}
        testId="toolbar-new-folder"
      >
        <FolderPlus className="w-4 h-4 stroke-current stroke-2" />
      </ToolButton>

      <div ref={uploadMenuRef} className="relative">
        <ToolButton
          onClick={() => setShowUploadMenu((prev) => !prev)}
          title={t(($) => $.file.action.upload)}
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
              {t(($) => $.file.action.uploadFiles)}
            </button>
            <button
              className="w-full px-3 py-2 text-left text-xs text-text bg-transparent border-none rounded cursor-pointer flex items-center gap-2 hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
              onClick={() => {
                setShowUploadMenu(false)
                void openFolderPicker()
              }}
            >
              <FolderUp className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.uploadFolder)}
            </button>
          </div>
        )}
      </div>

      <TextInputDialog
        open={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        onSubmit={(folderName) => void handleNewFolder(folderName)}
        title={t(($) => $.file.action.newFolder)}
        placeholder={t(($) => $.textInputDialog.newFolderPlaceholder)}
        submitText={t(($) => $.common.action.confirm)}
      />
    </div>
  )
}

export default FileExplorerToolbar
