import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import {
  Plus,
  Upload,
  FolderUp,
  Download,
  Copy,
  FolderInput,
  Pencil,
  Trash,
  FolderCog,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@renderer/utils/index.js'
import { FILE_TYPE } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'

interface FileExplorerContextMenuProps {
  files: FileInfo[]
  isEmptyArea: boolean
  onCopy: (files: FileInfo[]) => void
  onMove: (files: FileInfo[]) => void
  onDelete: (files: FileInfo[]) => void
  onRename: (file: FileInfo) => void
  onCreateFolder: () => void
  onUploadFiles: () => void
  onUploadFolder: () => void
  onDownload: (files: FileInfo[]) => void
  onProperties: (file: FileInfo) => void
}

export const FileExplorerContextMenu = ({
  files,
  isEmptyArea,
  onCopy,
  onMove,
  onDelete,
  onRename,
  onCreateFolder,
  onUploadFiles,
  onUploadFolder,
  onDownload,
  onProperties,
}: FileExplorerContextMenuProps) => {
  const { t } = useTranslation()

  const itemClass = cn(
    'w-full px-3 py-2 text-left text-xs text-text',
    'bg-transparent border-none rounded cursor-pointer',
    'flex items-center gap-2 transition-colors',
    'data-highlighted:bg-hover data-highlighted:outline-none',
    'focus-visible:outline-none',
  )

  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          'bg-glass-bg backdrop-blur-xl rounded-md shadow-dropdown border border-border',
          'p-1 min-w-40 z-1000 animate-menu-in',
        )}
      >
        {isEmptyArea ? (
          <>
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
          </>
        ) : (
          <>
            <ContextMenuPrimitive.Item className={itemClass} onSelect={() => onCopy(files)}>
              <Copy className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.copy)} {files.length > 1 ? `(${files.length})` : ''}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Item className={itemClass} onSelect={() => onMove(files)}>
              <FolderInput className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.move)} {files.length > 1 ? `(${files.length})` : ''}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Item className={itemClass} onSelect={() => onDownload(files)}>
              <Download className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.file.action.download)} {files.length > 1 ? `(${files.length})` : ''}
            </ContextMenuPrimitive.Item>
            {files.length === 1 && (
              <>
                <ContextMenuPrimitive.Separator className="h-px bg-border my-1" />
                <ContextMenuPrimitive.Item
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
              className={cn(itemClass, 'text-danger data-highlighted:bg-danger-light')}
              onSelect={() => onDelete(files)}
            >
              <Trash className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t(($) => $.common.action.delete)} {files.length > 1 ? `(${files.length})` : ''}
            </ContextMenuPrimitive.Item>
            {files.length === 1 && files[0]?.type === FILE_TYPE.DIRECTORY && (
              <>
                <ContextMenuPrimitive.Separator className="h-px bg-border my-1" />
                <ContextMenuPrimitive.Item
                  className={itemClass}
                  onSelect={() => {
                    const file = files[0]
                    if (file) onProperties(file)
                  }}
                >
                  <FolderCog className="w-3.5 h-3.5 stroke-current stroke-2" />
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
