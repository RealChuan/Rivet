import type React from 'react'
import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FILE_TYPE } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
import { formatDate, formatFileSize } from '@shared/utils/index.js'
import { FileIcon } from '../../../components/common/index.js'
import { cn } from '../../../utils/index.js'
import { computeTotalWidth } from '../hooks/use-column-resizing.js'
import { FILE_DRAG_MIME, type FileDragMove } from '../hooks/use-file-drag-move.js'
import { FILE_DRAG_SOURCE_ATTR, fileItemDataAttrs } from '../utils/data-attributes.js'

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
  isCut: boolean
  isPending: boolean
  isHovered: boolean
  isFocused: boolean
  isFavorite: boolean
  rowHeight: number
  isSftp: boolean
  dragMove: FileDragMove
  /** 正在被拖动，置灰 */
  isDragging: boolean
  /** 当前拖放目标，高亮 */
  isDropTarget: boolean
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
  isCut,
  isPending,
  isHovered,
  isFocused,
  isFavorite,
  rowHeight,
  isSftp,
  dragMove,
  isDragging,
  isDropTarget,
  onHover,
  onClick,
  onDoubleClick,
  onContextMenu,
  onFocus,
}: FileListItemProps) => {
  const { i18n } = useTranslation()
  const lng = i18n.language
  const totalWidth = computeTotalWidth(columnWidths, isSftp)
  const isDirectory = file.type === FILE_TYPE.DIRECTORY

  const sizeContent = file.type === FILE_TYPE.FILE ? formatFileSize(file.size ?? 0, lng) : '-'
  const modifyTimeContent = formatDate(file.modifyTime ?? 0, lng)
  // 已选中的条目整行可拖；未选中时只有名称列可拖，其余列留给框选（资源管理器行为）。
  const rowDragProps = isSelected ? { draggable: true, ...FILE_DRAG_SOURCE_ATTR } : {}

  return (
    <div
      role="gridcell"
      aria-selected={isSelected || isPending}
      tabIndex={isFocused ? 0 : -1}
      data-testid="file-row"
      {...fileItemDataAttrs(file)}
      {...rowDragProps}
      className={cn(
        'flex items-center border-b border-border min-w-full box-border relative select-none transition-colors duration-150 outline-none',
        isSelected || isPending
          ? 'bg-selected border-l-2 border-l-accent'
          : isHovered
            ? 'bg-hover border-l-2 border-l-transparent'
            : 'bg-transparent border-l-2 border-l-transparent',
        isSelected ? 'text-accent' : 'text-text',
        (isCut || isDragging) && 'opacity-50',
        isDropTarget && 'ring-2 ring-inset ring-accent',
      )}
      style={{ height: rowHeight, minWidth: totalWidth }}
      onMouseEnter={() => onHover(file.name)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onFocus={onFocus}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData(FILE_DRAG_MIME, file.absolutePath)
        dragMove.beginDrag(file)
      }}
      onDragEnd={dragMove.endDrag}
      onDragOver={(e) => {
        if (!isDirectory || !e.dataTransfer.types.includes(FILE_DRAG_MIME)) return
        e.preventDefault()
        // 不冒泡给列表容器，否则会亮起「拖入上传」的覆盖层。
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        dragMove.dragOver(file)
      }}
      onDragLeave={() => {
        if (isDirectory) dragMove.dragLeave()
      }}
      onDrop={(e) => {
        if (!isDirectory) return
        e.preventDefault()
        e.stopPropagation()
        dragMove.dropOn(file)
      }}
    >
      <div
        className="flex items-center gap-2.5 min-w-0 h-full"
        style={{ width: columnWidths.name }}
        title={file.name}
        draggable
        {...FILE_DRAG_SOURCE_ATTR}
      >
        <div className="px-2.5">
          <FileIcon type={file.type} name={file.name} />
        </div>
        <span className="text-sm overflow-hidden text-ellipsis whitespace-nowrap">{file.name}</span>
        {isFavorite && (
          <Star
            aria-hidden="true"
            data-testid="favorite-star"
            className="w-3 h-3 shrink-0 fill-current text-accent stroke-current stroke-2"
          />
        )}
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
        className="px-2.5 text-xs text-text-muted h-full flex items-center whitespace-nowrap overflow-hidden"
        style={{ width: columnWidths.modifyTime }}
        title={modifyTimeContent}
      >
        {modifyTimeContent}
      </div>
    </div>
  )
}

export default FileListItem
