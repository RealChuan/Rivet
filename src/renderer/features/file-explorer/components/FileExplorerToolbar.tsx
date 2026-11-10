import type React from 'react'
import {
  RefreshCw,
  FolderPlus,
  Upload,
  FolderUp,
  LayoutGrid,
  List,
  ChevronDown,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FILE_VIEW_MODE, TOAST_TYPE } from '@shared/constants/index.js'
import TextInputDialog from '../../../components/common/TextInputDialog.js'
import { useClickOutside } from '../../../hooks/index.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import { cn } from '../../../utils/index.js'
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

const ICON_CLASS = 'w-4 h-4 stroke-current stroke-2'
const ICON_CLASS_SM = 'w-3.5 h-3.5 stroke-current stroke-2'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2'

/** 图标按钮：无描边，选中态沿用标签页的 accent-light 底色。 */
const ToolButton = ({ onClick, title, isActive, testId, children }: ToolButtonProps) => (
  <button
    type="button"
    {...(testId ? { 'data-testid': testId } : {})}
    {...(isActive === undefined ? {} : { 'aria-pressed': isActive })}
    onClick={onClick}
    title={title}
    aria-label={title}
    className={cn(
      'w-7 h-7 rounded-md flex items-center justify-center border-none transition-colors duration-150',
      focusRing,
      isActive
        ? 'bg-accent-light text-accent'
        : 'bg-transparent text-text-muted hover:bg-hover hover:text-text',
    )}
  >
    {children}
  </button>
)

interface ToolTextButtonProps {
  onClick: () => void
  label: string
  testId?: string
  isMenu?: boolean
  isOpen?: boolean
  children: React.ReactNode
}

const ToolTextButton = ({
  onClick,
  label,
  testId,
  isMenu = false,
  isOpen = false,
  children,
}: ToolTextButtonProps) => (
  <button
    type="button"
    {...(testId ? { 'data-testid': testId } : {})}
    aria-haspopup={isMenu ? 'menu' : undefined}
    aria-expanded={isMenu ? isOpen : undefined}
    onClick={onClick}
    title={label}
    aria-label={label}
    className={cn(
      'h-7 px-2 rounded-md flex items-center gap-1.5 border-none text-xs text-text transition-colors',
      focusRing,
      isOpen ? 'bg-hover' : 'bg-transparent hover:bg-hover',
    )}
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
    <div className="flex items-center justify-between w-full gap-2">
      <div className="flex items-center gap-1">
        <ToolTextButton
          onClick={() => setNewFolderDialogOpen(true)}
          label={t(($) => $.file.action.newFolder)}
          testId="toolbar-new-folder"
        >
          <FolderPlus className={ICON_CLASS_SM} />
          {t(($) => $.file.action.newFolder)}
        </ToolTextButton>

        <div ref={uploadMenuRef} className="relative">
          <ToolTextButton
            onClick={() => setShowUploadMenu((prev) => !prev)}
            label={t(($) => $.file.action.upload)}
            isMenu
            isOpen={showUploadMenu}
          >
            <Upload className={ICON_CLASS_SM} />
            {t(($) => $.file.action.upload)}
            <ChevronDown
              className={cn(
                'w-3 h-3 stroke-current stroke-2 opacity-60 transition-transform duration-150',
                showUploadMenu && 'rotate-180',
              )}
            />
          </ToolTextButton>
          {showUploadMenu && (
            <div className="absolute left-0 top-full mt-1 bg-glass-bg rounded-lg shadow-dropdown border border-glass-border p-1 min-w-44 z-1000 animate-menu-in">
              <button
                type="button"
                className={`w-full px-2.5 py-2 text-left text-xs text-text bg-transparent border-none rounded-md flex items-center gap-2 hover:bg-hover transition-colors ${focusRing}`}
                onClick={() => {
                  setShowUploadMenu(false)
                  void openFilePicker()
                }}
              >
                <Upload className="w-3.5 h-3.5 stroke-current stroke-2" />
                {t(($) => $.file.action.uploadFiles)}
              </button>
              <button
                type="button"
                className={`w-full px-2.5 py-2 text-left text-xs text-text bg-transparent border-none rounded-md flex items-center gap-2 hover:bg-hover transition-colors ${focusRing}`}
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
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => void handleRefresh()}
          title={`${t(($) => $.common.action.refresh)} (F5)`}
          aria-label={t(($) => $.common.action.refresh)}
          data-testid="toolbar-refresh"
          className={cn(
            'w-7 h-7 rounded-md flex items-center justify-center border-none bg-transparent',
            'text-text-muted hover:bg-hover hover:text-text transition-colors',
            focusRing,
          )}
        >
          <RefreshCw className={ICON_CLASS} />
        </button>

        <div className="flex items-center gap-0.5">
          <ToolButton
            onClick={() => setFileViewMode(sessionId, FILE_VIEW_MODE.LIST)}
            title={t(($) => $.fileExplorerList.viewList)}
            isActive={fileViewMode === FILE_VIEW_MODE.LIST}
            testId="view-mode-list"
          >
            <List className={ICON_CLASS} />
          </ToolButton>

          <ToolButton
            onClick={() => setFileViewMode(sessionId, FILE_VIEW_MODE.GRID)}
            title={t(($) => $.fileExplorerList.viewGrid)}
            isActive={fileViewMode === FILE_VIEW_MODE.GRID}
            testId="view-mode-grid"
          >
            <LayoutGrid className={ICON_CLASS} />
          </ToolButton>
        </div>
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
