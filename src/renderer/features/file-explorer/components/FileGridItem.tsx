import type React from 'react'
import { Star } from 'lucide-react'
import type { FileInfo } from '@shared/types/index.js'
import { FILE_TYPE } from '@shared/constants/index.js'
import { FileIcon } from '../../../components/common/index.js'
import { cn } from '../../../utils/index.js'
import { FILE_DRAG_MIME, type FileDragMove } from '../hooks/use-file-drag-move.js'
import { FILE_DRAG_SOURCE_ATTR, fileItemDataAttrs } from '../utils/data-attributes.js'
import { FILE_GRID_GAP } from '../virtualization/layout.js'

interface FileGridItemProps {
  file: FileInfo
  isSelected: boolean
  isCut: boolean
  isFocused: boolean
  isFavorite: boolean
  width: number
  height: number
  dragMove: FileDragMove
  isDragging: boolean
  isDropTarget: boolean
  onSelect: (e: React.MouseEvent<HTMLElement>) => void
  onActivate: () => void
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void
  onFocus: () => void
}

export const FileGridItem = ({
  file,
  isSelected,
  isCut,
  isFocused,
  isFavorite,
  width,
  height,
  dragMove,
  isDragging,
  isDropTarget,
  onSelect,
  onActivate,
  onContextMenu,
  onFocus,
}: FileGridItemProps) => (
  <div
    role="gridcell"
    aria-selected={isSelected}
    tabIndex={isFocused ? 0 : -1}
    {...fileItemDataAttrs(file)}
    className={cn(
      'flex flex-col items-center justify-center gap-2 p-2 m-1 rounded-md select-none outline-none transition-colors duration-150',
      isSelected ? 'bg-selected text-accent' : 'bg-transparent text-text hover:bg-hover',
      (isCut || isDragging) && 'opacity-50',
      isDropTarget && 'ring-2 ring-inset ring-accent',
    )}
    // 单元盒比栅格槽位小一圈，外侧 m-1（4px）与相邻项合成 FILE_GRID_GAP，横纵间距一致。
    style={{ width: width - FILE_GRID_GAP, height: height - FILE_GRID_GAP }}
    onClick={onSelect}
    onDoubleClick={onActivate}
    onContextMenu={onContextMenu}
    onFocus={onFocus}
    title={file.name}
    onDragStart={(e) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData(FILE_DRAG_MIME, file.absolutePath)
      dragMove.beginDrag(file)
    }}
    onDragEnd={dragMove.endDrag}
    onDragOver={(e) => {
      if (file.type !== FILE_TYPE.DIRECTORY || !e.dataTransfer.types.includes(FILE_DRAG_MIME))
        return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      dragMove.dragOver(file)
    }}
    onDragLeave={() => {
      if (file.type === FILE_TYPE.DIRECTORY) dragMove.dragLeave()
    }}
    onDrop={(e) => {
      if (file.type !== FILE_TYPE.DIRECTORY) return
      e.preventDefault()
      e.stopPropagation()
      dragMove.dropOn(file)
    }}
  >
    <div draggable {...FILE_DRAG_SOURCE_ATTR}>
      <FileIcon type={file.type} name={file.name} className="w-14 h-14" />
    </div>
    <div className="flex items-center justify-center gap-1 w-full min-w-0">
      <span className="text-xs leading-tight min-w-0 truncate" draggable {...FILE_DRAG_SOURCE_ATTR}>
        {file.name}
      </span>
      {isFavorite && (
        <Star
          aria-hidden="true"
          data-testid="favorite-star"
          className="w-3 h-3 shrink-0 fill-current text-accent stroke-current stroke-2"
        />
      )}
    </div>
  </div>
)

export default FileGridItem
