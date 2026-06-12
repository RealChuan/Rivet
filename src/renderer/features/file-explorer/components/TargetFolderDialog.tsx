import type React from 'react'
import { ChevronLeft, ChevronRight, X, FolderPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileIcon } from '@renderer/components/common/index.js'
import TextInputDialog from '@renderer/components/common/TextInputDialog.js'
import Button from '@renderer/components/ui/Button.js'
import GlassDialog from '@renderer/components/ui/GlassDialog.js'
import VirtualList from '@renderer/components/ui/VirtualList.js'
import FileExplorerBreadcrumb from '@renderer/features/file-explorer/components/FileExplorerBreadcrumb.js'
import { useUiStore } from '@renderer/stores/index.js'
import { cn } from '@renderer/utils/index.js'
import logger from '@renderer/utils/logger.js'
import { FILE_TYPE, ROOT_PATH, TOAST_TYPE, DIALOG_SIZE } from '@shared/constants/index.js'
import { type FileInfo, isProtocolResponseErr } from '@shared/types/index.js'
import { formatErrorMessage, getParentPath } from '@shared/utils/index.js'

interface TargetFolderDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (targetDir: FileInfo) => void | Promise<void>
  sessionId: string
}

interface FolderItem extends FileInfo {
  isParent?: boolean
}

export const TargetFolderDialog: React.FC<TargetFolderDialogProps> = ({
  open,
  onClose,
  onConfirm,
  sessionId,
}) => {
  const { t } = useTranslation()
  const addToast = useUiStore(state => state.addToast)
  const [currentPath, setCurrentPath] = useState(ROOT_PATH)
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [isLoading, setIsLoading] = useState(open)
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null)
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)
  const currentRequestIdRef = useRef<string | null>(null)
  // 渲染期间同步 state：当 open 变化时重置对话框状态
  const [prevOpen, setPrevOpen] = useState(open)
  const [prevCurrentPath, setPrevCurrentPath] = useState(currentPath)

  if (open && open !== prevOpen) {
    setPrevOpen(open)
    setCurrentPath(ROOT_PATH)
    setSelectedFolder(null)
    setIsLoading(true)
  }
  if (currentPath !== prevCurrentPath) {
    setPrevCurrentPath(currentPath)
    setIsLoading(true)
  }

  useEffect(() => {
    if (!open) return

    const oldRequestId = currentRequestIdRef.current
    if (oldRequestId) {
      void window.electronAPI.protocol.cancel(oldRequestId).catch(() => {
        logger.debug('Failed to cancel previous request', { requestId: oldRequestId })
      })
    }

    const requestId = window.electronAPI.system.generateUuid()
    currentRequestIdRef.current = requestId

    const load = async () => {
      try {
        const result = await window.electronAPI.protocol.list(sessionId, currentPath, requestId)

        if (requestId !== currentRequestIdRef.current) {
          return
        }

        if (isProtocolResponseErr(result)) {
          logger.catch(result.error, { action: 'load-folders' })
          return
        }

        const files = result.value
        const dirs = files
          .filter((f: FileInfo) => f.type === FILE_TYPE.DIRECTORY)
          .map((f: FileInfo) => ({ ...f })) as FolderItem[]
        dirs.sort((a, b) => a.name.localeCompare(b.name))
        setFolders(dirs)
      } catch (error) {
        if (requestId !== currentRequestIdRef.current) {
          return
        }
        if (error instanceof Error && error.name !== 'AbortError') {
          logger.catch(error, { action: 'load-folders' })
        }
      } finally {
        if (requestId === currentRequestIdRef.current) {
          setIsLoading(false)
        }
      }
    }

    void load()
  }, [open, sessionId, currentPath])

  useEffect(() => {
    return () => {
      const requestId = currentRequestIdRef.current
      if (requestId) {
        void window.electronAPI.protocol.cancel(requestId).catch(() => {
          logger.debug('Failed to cancel previous request', { requestId })
        })
      }
    }
  }, [])

  const handleNavigate = (folder: FolderItem) => {
    setCurrentPath(folder.absolutePath)
    setSelectedFolder(null)
  }

  const handleParentDirectory = () => {
    if (currentPath === ROOT_PATH) return
    setCurrentPath(getParentPath(currentPath))
    setSelectedFolder(null)
  }

  const handleNewFolder = async (folderName: string) => {
    const newFolderPath =
      currentPath === ROOT_PATH ? `/${folderName}` : `${currentPath}/${folderName}`

    const mkdirResult = await window.electronAPI.protocol.mkdir(sessionId, newFolderPath)
    if (isProtocolResponseErr(mkdirResult)) {
      addToast({
        type: TOAST_TYPE.ERROR,
        message: `${t('toast.createFolderFailed')}: ${formatErrorMessage(mkdirResult.error) || t('error.unknown')}`,
      })
      return
    }

    addToast({ type: TOAST_TYPE.SUCCESS, message: t('toast.createFolderSuccess') })

    const oldRequestId = currentRequestIdRef.current
    if (oldRequestId) {
      void window.electronAPI.protocol.cancel(oldRequestId).catch(() => {
        logger.debug('Failed to cancel previous request', { requestId: oldRequestId })
      })
    }

    const requestId = window.electronAPI.system.generateUuid()
    currentRequestIdRef.current = requestId

    setIsLoading(true)

    try {
      const listResult = await window.electronAPI.protocol.list(sessionId, currentPath, requestId)

      if (requestId !== currentRequestIdRef.current) {
        return
      }

      if (isProtocolResponseErr(listResult)) {
        setIsLoading(false)
        return
      }

      const files = listResult.value
      const dirs = files
        .filter((f: FileInfo) => f.type === FILE_TYPE.DIRECTORY)
        .map((f: FileInfo) => ({ ...f })) as FolderItem[]
      dirs.sort((a, b) => a.name.localeCompare(b.name))
      setFolders(dirs)
    } catch (error) {
      if (requestId !== currentRequestIdRef.current) {
        return
      }
      if (error instanceof Error && error.name !== 'AbortError') {
        logger.catch(error, { action: 'load-folders-after-create' })
      }
    } finally {
      setIsLoading(false)
    }
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

  const renderFolderItem = (item: FolderItem, _index: number, style: React.CSSProperties) => {
    if (item.isParent || item.name === '..') {
      return (
        <button
          onClick={handleParentDirectory}
          className={`
            flex items-center gap-2 h-10 px-3 cursor-pointer
            border-none rounded transition-all duration-100
            bg-transparent text-text hover:bg-hover
          `}
          style={{ ...style, width: '100%' }}
          title={t('fileExplorerList.parentDirectory')}
        >
          <ChevronLeft className="w-4 h-4 stroke-text-muted stroke-2" />
          <span className="text-sm">{t('fileExplorerList.parentDirectory')}</span>
        </button>
      )
    }
    const isSelected = selectedFolder?.name === item.name
    return (
      <button
        onClick={() => setSelectedFolder(item)}
        onDoubleClick={() => handleNavigate(item)}
        className={`
          flex items-center gap-2 h-10 px-3 cursor-pointer
          border-none rounded transition-all duration-100
          focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
          ${isSelected ? 'bg-selected text-accent' : 'bg-transparent text-text hover:bg-hover'}
        `}
        style={{ ...style, width: '100%' }}
        title={item.name}
      >
        <FileIcon type={FILE_TYPE.DIRECTORY} />
        <span className="flex-1 text-sm text-left overflow-hidden text-ellipsis whitespace-nowrap">
          {item.name}
        </span>
        <ChevronRight
          className={cn(
            'w-4 h-4 stroke-1.5 transition-colors',
            isSelected ? 'stroke-accent' : 'stroke-text-muted'
          )}
        />
      </button>
    )
  }

  if (!open) return null

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
            <h2 className="text-base font-semibold text-text">{t('targetFolderDialog.title')}</h2>
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              className="p-1 rounded bg-transparent border-none cursor-pointer text-text-muted hover:text-text hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
            >
              <X className="w-4 h-4 stroke-current stroke-2" />
            </button>
          </div>

          <div className="pb-3 border-b border-border mb-3 shrink-0">
            <FileExplorerBreadcrumb
              path={currentPath}
              sessionId={sessionId}
              onNavigate={setCurrentPath}
            />
          </div>

          <div className="flex-1 min-h-10">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-xs text-text-muted">{t('fileExplorerList.loading')}</div>
              </div>
            ) : folders.length === 0 && currentPath === ROOT_PATH ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-xs text-text-muted">{t('fileExplorerList.empty')}</div>
              </div>
            ) : (
              <VirtualList
                items={allItems}
                itemHeight={40}
                width="100%"
                renderItem={renderFolderItem}
              />
            )}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNewFolderDialogOpen(true)}
                title={t('file.action.newFolder')}
                aria-label={t('file.action.newFolder')}
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
                {t('common.action.cancel')}
              </Button>
              <Button variant="primary" onClick={handleConfirm}>
                {t('common.action.confirm')}
              </Button>
            </div>
          </div>
        </div>
      </GlassDialog>

      <TextInputDialog
        open={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        onSubmit={name => void handleNewFolder(name)}
        title={t('file.action.newFolder')}
        placeholder={t('textInputDialog.newFolderPlaceholder')}
        submitText={t('common.action.confirm')}
      />
    </>
  )
}

export default TargetFolderDialog
