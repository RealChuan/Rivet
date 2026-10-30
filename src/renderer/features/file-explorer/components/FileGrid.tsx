import type { VirtualItem } from '@tanstack/react-virtual'
import type React from 'react'
import type { RefObject } from 'react'
import type { FileInfo } from '@shared/types/index.js'
import type { SelectionModel } from '../hooks/use-selection.js'
import FileGridItem from './FileGridItem.js'

interface FileGridProps {
  entries: FileInfo[]
  virtualRows: VirtualItem[]
  totalSize: number
  columns: number
  rowHeight: number
  selection: SelectionModel
  scrollRef: RefObject<HTMLDivElement | null>
  containerWidth: number
  onActivate: (file: FileInfo) => void
  onContextMenu: (file: FileInfo) => void
  onMouseDown: (e: React.MouseEvent) => void
}

export const FileGrid = ({
  entries,
  virtualRows,
  totalSize,
  columns,
  rowHeight,
  selection,
  scrollRef,
  containerWidth,
  onActivate,
  onContextMenu,
  onMouseDown,
}: FileGridProps) => {
  const cellWidth = columns > 0 ? containerWidth / columns : containerWidth

  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-rowcount={Math.ceil(entries.length / columns)}
      aria-multiselectable="true"
      className="h-full overflow-auto"
      onMouseDown={onMouseDown}
    >
      <div style={{ height: totalSize, position: 'relative' }}>
        {virtualRows.map((row) => {
          const rowEntries = entries.slice(row.index * columns, row.index * columns + columns)
          if (rowEntries.length === 0) return null
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
                display: 'flex',
              }}
            >
              {rowEntries.map((file) => (
                <FileGridItem
                  key={file.absolutePath}
                  file={file}
                  isSelected={selection.isSelected(file.absolutePath)}
                  isFocused={selection.focusedPath === file.absolutePath}
                  width={cellWidth}
                  height={rowHeight}
                  onSelect={(e) => {
                    selection.select(file.absolutePath, {
                      ctrl: e.ctrlKey || e.metaKey,
                      shift: e.shiftKey,
                    })
                    e.currentTarget.focus()
                  }}
                  onActivate={() => onActivate(file)}
                  onContextMenu={() => onContextMenu(file)}
                  onFocus={() => selection.focus(file.absolutePath)}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default FileGrid
