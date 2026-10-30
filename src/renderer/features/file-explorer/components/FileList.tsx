import type { VirtualItem } from '@tanstack/react-virtual'
import type React from 'react'
import type { RefObject } from 'react'
import type { FileInfo } from '@shared/types/index.js'
import type { SelectionModel } from '../hooks/use-selection.js'
import { computeTotalWidth } from '../hooks/use-column-resizing.js'
import FileListItem, { type ColumnWidths } from './FileListItem.js'

interface FileListProps {
  entries: FileInfo[]
  virtualRows: VirtualItem[]
  totalSize: number
  rowHeight: number
  columnWidths: ColumnWidths
  isSftp: boolean
  selection: SelectionModel
  scrollRef: RefObject<HTMLDivElement | null>
  onActivate: (file: FileInfo) => void
  onContextMenu: (file: FileInfo) => void
  onHover: (name: string | null) => void
  onMouseDown: (e: React.MouseEvent) => void
}

export const FileList = ({
  entries,
  virtualRows,
  totalSize,
  rowHeight,
  columnWidths,
  isSftp,
  selection,
  scrollRef,
  onActivate,
  onContextMenu,
  onHover,
  onMouseDown,
}: FileListProps) => {
  const totalWidth = computeTotalWidth(columnWidths, isSftp)

  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-rowcount={entries.length}
      aria-multiselectable="true"
      className="h-full overflow-auto"
      onMouseDown={onMouseDown}
    >
      <div style={{ height: totalSize, position: 'relative', minWidth: totalWidth }}>
        {virtualRows.map((row) => {
          const file = entries[row.index]
          if (!file) return null
          return (
            <div
              key={row.key}
              role="row"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: rowHeight,
                transform: `translateY(${row.start}px)`,
              }}
            >
              <FileListItem
                file={file}
                columnWidths={columnWidths}
                isSelected={selection.isSelected(file.absolutePath)}
                isPending={false}
                isHovered={false}
                isFocused={selection.focusedPath === file.absolutePath}
                rowHeight={rowHeight}
                isSftp={isSftp}
                onHover={onHover}
                onClick={(e) => {
                  selection.select(file.absolutePath, {
                    ctrl: e.ctrlKey || e.metaKey,
                    shift: e.shiftKey,
                  })
                  e.currentTarget.focus()
                }}
                onDoubleClick={() => onActivate(file)}
                onContextMenu={() => onContextMenu(file)}
                onFocus={() => selection.focus(file.absolutePath)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default FileList
