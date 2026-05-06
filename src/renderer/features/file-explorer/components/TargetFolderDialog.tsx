import { ChevronLeft, ChevronRight, X, FolderPlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FILE_TYPE, ROOT_PATH, TOAST_TYPE, DIALOG_SIZE } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
import { getParentPath } from '@shared/utils/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { FileIcon } from '../../../components/common/index.js'
import TextInputDialog from '../../../components/common/TextInputDialog.js'
import Button from '../../../components/ui/Button.js'
import GlassDialog from '../../../components/ui/GlassDialog.js'
import { useUiStore } from '../../../stores/index.js'
import { cn } from '../../../utils/index.js'
import { useDirectoryInvalidation } from '../hooks/use-directory-invalidation.js'
import { useDirectoryList } from '../hooks/use-directory-list.js'
import { useElementWidth } from '../hooks/use-element-width.js'
import { useVirtualRows } from '../hooks/use-virtual-rows.js'
import { computeFileViewLayout, FILE_LIST_ROW_HEIGHT } from '../virtualization/layout.js'
import FileExplorerBreadcrumb from './FileExplorerBreadcrumb.js'

interface TargetFolderDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (targetDir: FileInfo) => void | Promise<void>
  sessionId: string
}

interface FolderItem extends FileInfo {
  isParent?: boolean
}

export const TargetFolderDialog = ({
  open,
  onClose,
  onConfirm,
  sessionId,
}: TargetFolderDialogProps) => {
  const { t } = useTranslation()
  const addToast = useUiStore((state) => state.addToast)
  const [currentPath, setCurrentPath] = useState(ROOT_PATH)
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null)
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)

  const { files, isLoading } = useDirectoryList(open ? sessionId : '', currentPath)
  const { invalidatePath } = useDirectoryInvalidation()

  const folders: FolderItem[] = files
    .filter((file) => file.type === FILE_TYPE.DIRECTORY)
    .map((file) => ({ ...file }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const parentItem: FolderItem = {
    name: '..',
    type: FILE_TYPE.DIRECTORY,
    isParent: true,
    size: 0,
    modifyTime: 0,
    permissions: '',
    owner: '',
    absolutePath: getParentPath(currentPath),
  }

  const allItems: FolderItem[] = currentPath !== ROOT_PATH ? [parentItem, ...folders] : folders

  const scrollRef = useRef<HTMLDivElement>(null)
  const containerWidth = useElementWidth(scrollRef)
  const layout = computeFileViewLayout({
    entryCount: allItems.length,
    mode: 'list',
    containerWidth,
  })
  const virtualRows = useVirtualRows({
    rowCount: layout.rowCount,
    rowHeight: FILE_LIST_ROW_HEIGHT,
    scrollRef,
  })

  const handleNavigate = (folder: FolderItem) => {
    setCurrentPath(folder.absolutePath)
    setSelectedFolder(null)
  }

  const handleParentDirectory = () => {
    if (currentPath === ROOT_PATH) return
    setCurrentPath(getParentPath(currentPath))
    setSelectedFolder(null)
  }

  const handleBreadcrumbNavigate = (path: string) => {
    setCurrentPath(path)
  }

  const handleNewFolder = async (folderName: string) => {
    const newFolderPath =
      currentPath === ROOT_PATH ? `/${folderName}` : `${currentPath}/${folderName}`

    try {
      await protocolApi.mkdir(sessionId, newFolderPath)
    } catch (error) {
      addToast({
        type: TOAST_TYPE.ERROR,
        message: `${t(($) => $.toast.createFolderFailed)}: ${error instanceof Error ? error.message : t(($) => $.error.unknown)}`,
      })
      return
    }

    addToast({ type: TOAST_TYPE.SUCCESS, message: t(($) => $.toast.createFolderSuccess) })
    await invalidatePath(sessionId, currentPath)
  }

  const handleConfirm = () => {
    const targetDir: FileInfo = selectedFolder ?? {
      name: currentPath === ROOT_PATH ? ROOT_PATH : (currentPath.split('/').pop() ?? ''),
      type: FILE_TYPE.DIRECTORY,
      size: 0,
      modifyTime: 0,
      permissions: '',
      owner: '',
      absolutePath: currentPath,
    }
    void onConfirm(targetDir)
  }

  const renderFolderItem = (item: FolderItem) => {
    if (item.isParent || item.name === '..') {
      return (
        <button
          onClick={handleParentDirectory}
          className={`
            flex items-center gap-2 h-full px-3 cursor-pointer w-full
            border-none rounded transition-all duration-100
            bg-transparent text-text hover:bg-hover
          `}
          title={t(($) => $.fileExplorerList.parentDirectory)}
        >
          <ChevronLeft className="w-4 h-4 stroke-text-muted stroke-2" />
          <span className="text-sm">{t(($) => $.fileExplorerList.parentDirectory)}</span>
        </button>
      )
    }
    const isSelected = selectedFolder?.name === item.name
    return (
      <button
        onClick={() => setSelectedFolder(item)}
        onDoubleClick={() => handleNavigate(item)}
        className={`
          flex items-center gap-2 h-full px-3 cursor-pointer w-full
          border-none rounded transition-all duration-100
          focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
          ${isSelected ? 'bg-selected text-accent' : 'bg-transparent text-text hover:bg-hover'}
        `}
        title={item.name}
      >
        <FileIcon type={FILE_TYPE.DIRECTORY} />
        <span className="flex-1 text-sm text-left overflow-hidden text-ellipsis whitespace-nowrap">
          {item.name}
        </span>
        <ChevronRight
          className={cn(
            'w-4 h-4 stroke-1.5 transition-colors',
            isSelected ? 'stroke-accent' : 'stroke-text-muted',
          )}
        />
      </button>
    )
  }

  if (!open) return null

  return (
    <>
      <GlassDialog
        open={open}
        onClose={onClose}
        width={DIALOG_SIZE.LARGE.width}
        height={DIALOG_SIZE.LARGE.height}
      >
        <div className="flex flex-col h-113 w-full overflow-hidden">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-base font-semibold text-text">
              {t(($) => $.targetFolderDialog.title)}
            </h2>
            <button
              onClick={onClose}
              aria-label={t(($) => $.common.close)}
              className="p-1 rounded bg-transparent border-none cursor-pointer text-text-muted hover:text-text hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
            >
              <X className="w-4 h-4 stroke-current stroke-2" />
            </button>
          </div>

          <div className="pb-3 border-b border-border mb-3 shrink-0">
            <FileExplorerBreadcrumb
              path={currentPath}
              sessionId={sessionId}
              onNavigate={handleBreadcrumbNavigate}
            />
          </div>

          <div className="flex-1 min-h-10">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-xs text-text-muted">
                  {t(($) => $.fileExplorerList.loading)}
                </div>
              </div>
            ) : folders.length === 0 && currentPath === ROOT_PATH ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-xs text-text-muted">{t(($) => $.fileExplorerList.empty)}</div>
              </div>
            ) : (
              <div ref={scrollRef} className="h-full overflow-auto">
                <div style={{ height: layout.totalSize, position: 'relative' }}>
                  {virtualRows.map((row) => {
                    const item = allItems[row.index]
                    if (!item) return null
                    return (
                      <div
                        key={row.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: FILE_LIST_ROW_HEIGHT,
                          transform: `translateY(${row.start}px)`,
                        }}
                      >
                        {renderFolderItem(item)}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNewFolderDialogOpen(true)}
                title={t(($) => $.file.action.newFolder)}
                aria-label={t(($) => $.file.action.newFolder)}
                className={`
                  p-1.5 rounded flex items-center justify-center
                  border-none cursor-pointer transition-all duration-150
                  text-text hover:bg-hover
                  focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
                `}
              >
                <FolderPlus className="w-4 h-4 stroke-current stroke-2" />
              </button>
              <div
                className="text-xs text-text-muted px-3 py-2 bg-hover rounded max-w-60 overflow-hidden text-ellipsis whitespace-nowrap"
                title={currentPath}
              >
                {currentPath ?? ROOT_PATH}
              </div>
            </div>
            <div className="flex gap-2.5">
              <Button variant="secondary" onClick={onClose}>
                {t(($) => $.common.action.cancel)}
              </Button>
              <Button variant="primary" onClick={handleConfirm}>
                {t(($) => $.common.action.confirm)}
              </Button>
            </div>
          </div>
        </div>
      </GlassDialog>

      <TextInputDialog
        open={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        onSubmit={(name) => void handleNewFolder(name)}
        title={t(($) => $.file.action.newFolder)}
        placeholder={t(($) => $.textInputDialog.newFolderPlaceholder)}
        submitText={t(($) => $.common.action.confirm)}
      />
    </>
  )
}

export default TargetFolderDialog
