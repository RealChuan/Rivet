import type React from 'react'
import type { FileInfo } from '@shared/types/index.js'
import { FileIcon } from '../../../components/common/index.js'
import { cn } from '../../../utils/index.js'
import { FILE_GRID_GAP } from '../virtualization/layout.js'

interface FileGridItemProps {
  file: FileInfo
  isSelected: boolean
  isFocused: boolean
  width: number
  height: number
  onSelect: (e: React.MouseEvent<HTMLElement>) => void
  onActivate: () => void
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void
  onFocus: () => void
}

export const FileGridItem = ({
  file,
  isSelected,
  isFocused,
  width,
  height,
  onSelect,
  onActivate,
  onContextMenu,
  onFocus,
}: FileGridItemProps) => (
  <div
    role="gridcell"
    aria-selected={isSelected}
    tabIndex={isFocused ? 0 : -1}
    data-file-item={file.name}
    data-file-path={file.absolutePath}
    className={cn(
      'flex flex-col items-center justify-center gap-2 p-2 m-1 rounded-md cursor-pointer select-none outline-none transition-colors duration-150',
      isSelected ? 'bg-selected text-accent' : 'bg-transparent text-text hover:bg-hover',
    )}
    // 单元盒比栅格槽位小一圈，外侧 m-1（4px）与相邻项合成 FILE_GRID_GAP，横纵间距一致。
    style={{ width: width - FILE_GRID_GAP, height: height - FILE_GRID_GAP }}
    onClick={onSelect}
    onDoubleClick={onActivate}
    onContextMenu={onContextMenu}
    onFocus={onFocus}
    title={file.name}
  >
    <FileIcon type={file.type} className="w-14 h-14" />
    <span className="text-[13px] leading-tight w-full text-center truncate">{file.name}</span>
  </div>
)

export default FileGridItem
