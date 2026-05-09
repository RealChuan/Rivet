import React from 'react'
import { FileInfo } from '@shared/types'

interface ColumnWidths {
  name: number
  permissions: number
  owner: number
  size: number
  modifyTime: number
}

interface FileItemProps {
  file: FileInfo
  columnWidths: ColumnWidths
  isSelected: boolean
  isPending: boolean
  isHovered: boolean
  onHover: (name: string | null) => void
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  formatFileSize: (bytes: number) => string
  formatDate: (timestamp: number) => string
  style?: React.CSSProperties
}

export const FileItem: React.FC<FileItemProps> = ({
  file,
  columnWidths,
  isSelected,
  isPending,
  isHovered,
  onHover,
  onClick,
  onDoubleClick,
  onContextMenu,
  formatFileSize,
  formatDate,
  style,
}) => {
  const totalWidth =
    columnWidths.name +
    columnWidths.permissions +
    columnWidths.owner +
    columnWidths.size +
    columnWidths.modifyTime +
    24

  const nameContent = file.name
  const permissionsContent = file.permissions || '-'
  const ownerContent = file.owner || '-'
  const sizeContent = file.type === 'file' ? formatFileSize(file.size || 0) : '-'
  const modifyTimeContent = formatDate(file.modifyTime || 0)

  const getBgColor = () => {
    if (isSelected || isPending) return 'bg-selected'
    if (isHovered) return 'bg-hover'
    return 'bg-transparent'
  }

  const getTextColor = () => {
    return isSelected ? 'text-accent' : 'text-text'
  }

  return (
    <div
      key={file.name}
      data-file-item={file.name}
      className={`
        flex items-center h-10 cursor-pointer
        border-b border-border min-w-full box-border
        relative select-none transition-all duration-100
        ${getBgColor()} ${getTextColor()}
      `}
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
          {file.type === 'directory' ? (
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              stroke="none"
              fill="var(--warning, #FFB600)"
            >
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="rgba(100, 149, 237, 0.85)"
              stroke="rgba(64, 115, 195, 0.75)"
              strokeWidth="1.5"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          )}
        </div>
        <span className="text-sm overflow-hidden text-ellipsis whitespace-nowrap">{file.name}</span>
      </div>
      <div className="w-1.5" />
      <div
        className="px-2.5 text-xs text-text-muted h-full flex items-center"
        style={{ width: columnWidths.permissions }}
        title={permissionsContent}
      >
        {file.permissions || '-'}
      </div>
      <div className="w-1.5" />
      <div
        className="px-2.5 text-xs text-text-muted h-full flex items-center"
        style={{ width: columnWidths.owner }}
        title={ownerContent}
      >
        {file.owner || '-'}
      </div>
      <div className="w-1.5" />
      <div
        className="px-2.5 text-xs text-text-muted h-full flex items-center"
        style={{ width: columnWidths.size }}
        title={sizeContent}
      >
        {file.type === 'file' ? formatFileSize(file.size || 0) : '-'}
      </div>
      <div className="w-1.5" />
      <div
        className="px-2.5 text-xs text-text-muted h-full flex items-center"
        style={{ width: columnWidths.modifyTime }}
        title={modifyTimeContent}
      >
        {formatDate(file.modifyTime || 0)}
      </div>
    </div>
  )
}

export default FileItem
