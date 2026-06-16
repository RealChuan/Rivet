import type React from 'react'
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
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useClickOutside } from '@renderer/hooks/index.js'
import { FILE_TYPE } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'

interface FileExplorerContextMenuProps {
  x: number
  y: number
  files: FileInfo[]
  isEmptyArea: boolean
  onClose: () => void
  onCreateFolder: () => void
  onRename: (file: FileInfo) => void
  onDelete: (files: FileInfo[]) => void
  onCopy: (files: FileInfo[]) => void
  onMove: (files: FileInfo[]) => void
  onUploadFiles: () => void
  onUploadFolder: () => void
  onDownload: (files: FileInfo[]) => void
  onProperties: (file: FileInfo) => void
}

export const FileExplorerContextMenu: React.FC<FileExplorerContextMenuProps> = ({
  x,
  y,
  files,
  isEmptyArea,
  onClose,
  onCreateFolder,
  onRename,
  onDelete,
  onCopy,
  onMove,
  onUploadFiles,
  onUploadFolder,
  onDownload,
  onProperties,
}) => {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)

  useClickOutside({
    ref: menuRef,
    event: 'click',
    onOutside: onClose,
  })

  const menuClass = `
    fixed bg-glass-bg backdrop-blur-xl rounded-md shadow-dropdown border border-border
    p-1 min-w-[160px] z-[1000] animate-menu-in
  `

  const itemClass = `
    w-full px-3 py-2 text-left text-xs text-text
    bg-transparent border-none rounded cursor-pointer
    flex items-center gap-2 hover:bg-hover transition-colors
    focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
  `

  const separatorClass = 'h-px bg-border my-1'

  const handleItemClick = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div ref={menuRef} className={menuClass} style={{ left: x, top: y }}>
      {isEmptyArea ? (
        <>
          <button className={itemClass} onClick={() => handleItemClick(onCreateFolder)}>
            <Plus className="w-3.5 h-3.5 stroke-current stroke-2" />
            {t('file.action.newFolder')}
          </button>
          <div className={separatorClass} />
          <button className={itemClass} onClick={() => handleItemClick(onUploadFiles)}>
            <Upload className="w-3.5 h-3.5 stroke-current stroke-2" />
            {t('file.action.uploadFiles')}
          </button>
          <button className={itemClass} onClick={() => handleItemClick(onUploadFolder)}>
            <FolderUp className="w-3.5 h-3.5 stroke-current stroke-2" />
            {t('file.action.uploadFolder')}
          </button>
        </>
      ) : (
        <>
          <button className={itemClass} onClick={() => handleItemClick(() => onCopy(files))}>
            <Copy className="w-3.5 h-3.5 stroke-current stroke-2" />
            {t('file.action.copy')} {files.length > 1 ? `(${files.length})` : ''}
          </button>
          <button className={itemClass} onClick={() => handleItemClick(() => onMove(files))}>
            <FolderInput className="w-3.5 h-3.5 stroke-current stroke-2" />
            {t('file.action.move')} {files.length > 1 ? `(${files.length})` : ''}
          </button>
          <button className={itemClass} onClick={() => handleItemClick(() => onDownload(files))}>
            <Download className="w-3.5 h-3.5 stroke-current stroke-2" />
            {t('file.action.download')} {files.length > 1 ? `(${files.length})` : ''}
          </button>
          {files.length === 1 && (
            <>
              <div className={separatorClass} />
              <button
                className={itemClass}
                onClick={() => {
                  const file = files[0]
                  if (file) handleItemClick(() => onRename(file))
                }}
              >
                <Pencil className="w-3.5 h-3.5 stroke-current stroke-2" />
                {t('file.action.rename')}
              </button>
            </>
          )}
          <div className={separatorClass} />
          <button
            className={`${itemClass} text-danger hover:bg-danger-light`}
            onClick={() => handleItemClick(() => onDelete(files))}
          >
            <Trash className="w-3.5 h-3.5 stroke-current stroke-2" />
            {t('common.action.delete')} {files.length > 1 ? `(${files.length})` : ''}
          </button>
          <div className={separatorClass} />
          {files.length === 1 && files[0]?.type === FILE_TYPE.DIRECTORY && (
            <button
              className={itemClass}
              onClick={() => {
                const file = files[0]
                if (file) {
                  handleItemClick(() => onProperties(file))
                }
              }}
            >
              <FolderCog className="w-3.5 h-3.5 stroke-current stroke-2" />
              {t('file.action.properties')}
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default FileExplorerContextMenu
