import type React from 'react'
import { useTranslation } from 'react-i18next'
import { FileIcon } from '@renderer/components/common/index.js'
import { computeTotalWidth } from '@renderer/features/file-explorer/hooks/use-column-resizing.js'
import { cn } from '@renderer/utils/index.js'
import { FILE_TYPE } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
import { formatDate, formatFileSize } from '@shared/utils/index.js'

interface ColumnWidths {
  name: number
  permissions: number
  owner: number
  size: number
  modifyTime: number
}

interface FileExplorerItemProps {
  file: FileInfo
  columnWidths: ColumnWidths
  isSelected: boolean
  isPending: boolean
  isHovered: boolean
  onHover: (name: string | null) => void
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  style?: React.CSSProperties
  isSftp?: boolean
  containerWidth?: number
}

export const FileExplorerItem = ({
  file,
  columnWidths,
  isSelected,
  isPending,
  isHovered,
  onHover,
  onClick,
  onDoubleClick,
  onContextMenu,
  style,
  isSftp = false,
}: FileExplorerItemProps) => {
  const { i18n } = useTranslation()
  const lng = i18n.language
  const totalWidth = computeTotalWidth(columnWidths, isSftp)

  const nameContent = file.name
  const permissionsContent = file.permissions ?? '-'
  const ownerContent = file.owner ?? '-'
  const sizeContent = file.type === FILE_TYPE.FILE ? formatFileSize(file.size ?? 0, lng) : '-'
  const modifyTimeContent = formatDate(file.modifyTime ?? 0, lng)

  return (
    <div
      data-file-item={file.name}
      className={cn(
        'flex items-center h-10 cursor-pointer border-b border-border min-w-full box-border relative select-none transition-all duration-150',
        isSelected || isPending
          ? 'bg-selected border-l-2 border-l-accent'
          : isHovered
            ? 'bg-hover border-l-2 border-l-transparent'
            : 'bg-transparent border-l-2 border-l-transparent',
        isSelected ? 'text-accent' : 'text-text',
      )}
      style={{ ...style, minWidth: totalWidth }}
      onMouseEnter={() => onHover(file.name)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div
        className="flex items-center gap-2.5 min-w-0 h-full"
        style={{ width: columnWidths.name }}
        title={nameContent}
      >
        <div className="px-2.5">
          <FileIcon type={file.type} />
        </div>
        <span className="text-sm overflow-hidden text-ellipsis whitespace-nowrap">{file.name}</span>
      </div>
      <div className="w-1.5" />
      {isSftp && (
        <>
          <div
            className="px-2.5 text-xs text-text-muted h-full flex items-center"
            style={{ width: columnWidths.permissions }}
            title={permissionsContent}
          >
            {permissionsContent}
          </div>
          <div className="w-1.5" />
          <div
            className="px-2.5 text-xs text-text-muted h-full flex items-center"
            style={{ width: columnWidths.owner }}
            title={ownerContent}
          >
            {ownerContent}
          </div>
          <div className="w-1.5" />
        </>
      )}
      <div
        className="px-2.5 text-xs text-text-muted h-full flex items-center"
        style={{ width: columnWidths.size }}
        title={sizeContent}
      >
        {sizeContent}
      </div>
      <div className="w-1.5" />
      <div
        className="px-2.5 text-xs text-text-muted h-full flex items-center"
        style={{ width: columnWidths.modifyTime }}
        title={modifyTimeContent}
      >
        {modifyTimeContent}
      </div>
    </div>
  )
}

export default FileExplorerItem
