import {
  Plus,
  Upload,
  FolderUp,
  Download,
  Copy,
  CopyPlus,
  ClipboardCopy,
  ClipboardPaste,
  FolderInput,
  Pencil,
  Scissors,
  Star,
  Trash,
  Info,
  Lock,
} from 'lucide-react'
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import { useTranslation } from 'react-i18next'

import { FILE_TYPE } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
import { cn } from '../../../utils/index.js'

interface FileExplorerContextMenuProps {
  files: FileInfo[]
  isEmptyArea: boolean
  canPaste: boolean
  onCopy: (files: FileInfo[]) => void
  onCut: (files: FileInfo[]) => void
  onPaste: () => void
  onCopyTo: (files: FileInfo[]) => void
  onMoveTo: (files: FileInfo[]) => void
  onDelete: (files: FileInfo[]) => void
  onRename: (file: FileInfo) => void
  onCreateFolder: () => void
  onUploadFiles: () => void
  onUploadFolder: () => void
  onDownload: (files: FileInfo[]) => void
  onProperties: (file: FileInfo) => void
  /** 仅 SFTP 会话的单个条目可用 */
  onPermissions: (file: FileInfo) => void
  isSftp?: boolean | undefined
  /** 传入空数组表示复制当前目录路径 */
  onCopyPath: (files: FileInfo[]) => void
  isFavorite: (file: FileInfo) => boolean
  onToggleFavorite: (file: FileInfo) => void
}

export const FileExplorerContextMenu = ({
  files,
  isEmptyArea,
  canPaste,
  onCopy,
  onCut,
  onPaste,
  onCopyTo,
  onMoveTo,
  onDelete,
  onRename,
  onCreateFolder,
  onUploadFiles,
  onUploadFolder,
  onDownload,
  onProperties,
  onPermissions,
  isSftp,
  onCopyPath,
  isFavorite,
  onToggleFavorite,
}: FileExplorerContextMenuProps) => {
  const { t } = useTranslation()

  const singleItem = files.length === 1 ? files[0] : undefined
  const singleDirectory = singleItem?.type === FILE_TYPE.DIRECTORY ? singleItem : undefined
  const favorite = singleDirectory ? isFavorite(singleDirectory) : false

  const itemClass = cn(
    'w-full px-3 py-2 text-left text-xs text-text',
    'bg-transparent border-none rounded',
    'flex items-center gap-2 transition-colors',
    'data-highlighted:bg-hover data-highlighted:outline-none',
    'focus-visible:outline-none',
  )

  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          'bg-glass-bg rounded-md shadow-dropdown',
          'border border-glass-border p-1 min-w-40 z-1000 animate-menu-in',
        )}
      >
        {isEmptyArea ? (
          <>
            <ContextMenuPrimitive.Item
              className={cn(itemClass, 'data-disabled:opacity-40 data-disabled:cursor-default')}
              disabled={!canPaste}
              onSelect={() => onPaste()}
            >
              <ClipboardPaste className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.paste)}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Separator className="h-px bg-border my-1" />
            <ContextMenuPrimitive.Item className={itemClass} onSelect={() => onCreateFolder()}>
              <Plus className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.newFolder)}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Separator className="h-px bg-border my-1" />
            <ContextMenuPrimitive.Item className={itemClass} onSelect={() => onUploadFiles()}>
              <Upload className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.uploadFiles)}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Item className={itemClass} onSelect={() => onUploadFolder()}>
              <FolderUp className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.uploadFolder)}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Separator className="h-px bg-border my-1" />
            <ContextMenuPrimitive.Item
              data-testid="context-copy-path"
              className={itemClass}
              onSelect={() => onCopyPath([])}
            >
              <ClipboardCopy className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.copyPath)}
            </ContextMenuPrimitive.Item>
          </>
        ) : (
          <>
            <ContextMenuPrimitive.Item className={itemClass} onSelect={() => onCut(files)}>
              <Scissors className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.cut)} {files.length > 1 ? `(${files.length})` : ''}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Item className={itemClass} onSelect={() => onCopy(files)}>
              <Copy className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.copy)} {files.length > 1 ? `(${files.length})` : ''}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Item
              data-testid="context-copy-path"
              className={itemClass}
              onSelect={() => onCopyPath(files)}
            >
              <ClipboardCopy className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.copyPath)} {files.length > 1 ? `(${files.length})` : ''}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Separator className="h-px bg-border my-1" />
            <ContextMenuPrimitive.Item className={itemClass} onSelect={() => onCopyTo(files)}>
              <CopyPlus className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.copyTo)} {files.length > 1 ? `(${files.length})` : ''}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Item className={itemClass} onSelect={() => onMoveTo(files)}>
              <FolderInput className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.moveTo)} {files.length > 1 ? `(${files.length})` : ''}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Separator className="h-px bg-border my-1" />
            <ContextMenuPrimitive.Item className={itemClass} onSelect={() => onDownload(files)}>
              <Download className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.download)} {files.length > 1 ? `(${files.length})` : ''}
            </ContextMenuPrimitive.Item>
            {files.length === 1 && (
              <>
                <ContextMenuPrimitive.Separator className="h-px bg-border my-1" />
                <ContextMenuPrimitive.Item
                  data-testid="context-rename"
                  className={itemClass}
                  onSelect={() => {
                    const file = files[0]
                    if (file) onRename(file)
                  }}
                >
                  <Pencil className="w-3.5 h-3.5 stroke-current stroke-2" />
                  {t(($) => $.file.action.rename)}
                </ContextMenuPrimitive.Item>
              </>
            )}
            <ContextMenuPrimitive.Separator className="h-px bg-border my-1" />
            <ContextMenuPrimitive.Item
              data-testid="context-delete"
              className={cn(itemClass, 'text-danger data-highlighted:bg-danger-light')}
              onSelect={() => onDelete(files)}
            >
              <Trash className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.common.action.delete)} {files.length > 1 ? `(${files.length})` : ''}
            </ContextMenuPrimitive.Item>
            {singleItem && (
              <>
                <ContextMenuPrimitive.Separator className="h-px bg-border my-1" />
                {isSftp && (
                  <ContextMenuPrimitive.Item
                    data-testid="context-permissions"
                    className={itemClass}
                    onSelect={() => onPermissions(singleItem)}
                  >
                    <Lock className="w-3.5 h-3.5 stroke-current stroke-2" />
                    {t(($) => $.file.action.permissions)}
                  </ContextMenuPrimitive.Item>
                )}
                {singleDirectory && (
                  <ContextMenuPrimitive.Item
                    data-testid="context-favorite"
                    className={itemClass}
                    onSelect={() => onToggleFavorite(singleDirectory)}
                  >
                    <Star
                      className={cn(
                        'w-3.5 h-3.5 stroke-current stroke-2',
                        favorite && 'fill-current text-accent',
                      )}
                    />
                    {favorite ? t(($) => $.favorites.remove) : t(($) => $.favorites.add)}
                  </ContextMenuPrimitive.Item>
                )}
                <ContextMenuPrimitive.Item
                  data-testid="context-properties"
                  className={itemClass}
                  onSelect={() => onProperties(singleItem)}
                >
                  <Info className="w-3.5 h-3.5 stroke-current stroke-2" />
                  {t(($) => $.file.action.properties)}
                </ContextMenuPrimitive.Item>
              </>
            )}
          </>
        )}
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  )
}

export default FileExplorerContextMenu
