import type React from 'react'
import { useTranslation } from 'react-i18next'
import { FILE_TYPE } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
import { formatDate, formatFileSize } from '@shared/utils/index.js'
import { FileIcon } from '../../../components/common/index.js'
import { cn } from '../../../utils/index.js'
import { computeTotalWidth } from '../hooks/use-column-resizing.js'

export interface ColumnWidths {
  name: number
  permissions: number
  owner: number
  size: number
  modifyTime: number
}

interface FileListItemProps {
  file: FileInfo
  columnWidths: ColumnWidths
  isSelected: boolean
  isPending: boolean
  isHovered: boolean
  isFocused: boolean
  rowHeight: number
  isSftp: boolean
  onHover: (name: string | null) => void
  onClick: (e: React.MouseEvent<HTMLElement>) => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void
  onFocus: () => void
}

export const FileListItem = ({
  file,
  columnWidths,
  isSelected,
  isPending,
  isHovered,
  isFocused,
  rowHeight,
  isSftp,
  onHover,
  onClick,
  onDoubleClick,
  onContextMenu,
  onFocus,
}: FileListItemProps) => {
  const { i18n } = useTranslation()
  const lng = i18n.language
  const totalWidth = computeTotalWidth(columnWidths, isSftp)

  const sizeContent = file.type === FILE_TYPE.FILE ? formatFileSize(file.size ?? 0, lng) : '-'
  const modifyTimeContent = formatDate(file.modifyTime ?? 0, lng)

  return (
    <div
      role="gridcell"
      aria-selected={isSelected || isPending}
      tabIndex={isFocused ? 0 : -1}
      data-testid="file-row"
      data-file-item={file.name}
      data-file-path={file.absolutePath}
      className={cn(
        'flex items-center cursor-pointer border-b border-border min-w-full box-border relative select-none transition-colors duration-150 outline-none',
        isSelected || isPending
          ? 'bg-selected border-l-2 border-l-accent'
          : isHovered
            ? 'bg-hover border-l-2 border-l-transparent'
            : 'bg-transparent border-l-2 border-l-transparent',
        isSelected ? 'text-accent' : 'text-text',
      )}
      style={{ height: rowHeight, minWidth: totalWidth }}
      onMouseEnter={() => onHover(file.name)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onFocus={onFocus}
    >
      <div
        className="flex items-center gap-2.5 min-w-0 h-full"
        style={{ width: columnWidths.name }}
        title={file.name}
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
            title={file.permissions ?? '-'}
          >
            {file.permissions ?? '-'}
          </div>
          <div className="w-1.5" />
          <div
            className="px-2.5 text-xs text-text-muted h-full flex items-center"
            style={{ width: columnWidths.owner }}
            title={file.owner ?? '-'}
          >
            {file.owner ?? '-'}
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

export default FileListItem
