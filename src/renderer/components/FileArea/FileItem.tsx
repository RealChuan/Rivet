import React from 'react'
import { FileInfo } from '../../../shared/types.js'
import FileIcon from '../ui/FileIcon.js'
import { formatFileSize, formatDate } from '../../utils/utils.js'

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
          <FileIcon type={file.type} />
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
