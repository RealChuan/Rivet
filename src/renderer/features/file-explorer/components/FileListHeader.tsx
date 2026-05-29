import type React from 'react'
import { useTranslation } from 'react-i18next'
import {
  type FileExplorerSortField,
  SORT_ORDER,
  type SortOrderWithDirection,
} from '@shared/constants/index.js'

interface ColumnWidths {
  name: number
  permissions: number
  owner: number
  size: number
  modifyTime: number
}

interface FileListHeaderProps {
  columnWidths: ColumnWidths
  sortBy: FileExplorerSortField
  sortOrder: SortOrderWithDirection
  onSort: (column: FileExplorerSortField) => void
  onResizeStart: (column: string, x: number, width: number) => void
  isWebdav?: boolean
}

const RESIZER_GAP = 10

interface SortIconProps {
  sortBy: FileExplorerSortField
  sortOrder: SortOrderWithDirection
  column: string
}

const SortIcon = ({ sortBy, sortOrder, column }: SortIconProps) => {
  if (sortBy !== column) return null
  return (
    <svg
      className={`
        w-4 h-4 stroke-accent stroke-2
        ${sortOrder === SORT_ORDER.DESC ? 'rotate-180' : ''}
      `}
      viewBox="0 0 24 24"
      fill="none"
    >
      <polyline points="18 9 12 15 6 9" />
    </svg>
  )
}

interface ColumnResizerProps {
  column: string
  columnWidths: ColumnWidths
  onResizeStart: (column: string, x: number, width: number) => void
}

const ColumnResizer = ({ column, columnWidths, onResizeStart }: ColumnResizerProps) => (
  <div
    onMouseDown={e => {
      e.preventDefault()
      onResizeStart(column, e.clientX, columnWidths[column as keyof ColumnWidths])
    }}
    className={`
      w-1.5 cursor-col-resize flex items-center justify-center
      select-none hover:bg-border transition-colors
    `}
  >
    <div className="w-0.5 h-4 bg-text-muted/50 rounded" />
  </div>
)

interface ColumnHeaderProps {
  column: FileExplorerSortField
  label: string
  isFirst?: boolean
  isLast?: boolean
  columnWidths: ColumnWidths
  sortBy: FileExplorerSortField
  sortOrder: SortOrderWithDirection
  onSort: (column: FileExplorerSortField) => void
  onResizeStart: (column: string, x: number, width: number) => void
}

const ColumnHeader = ({
  column,
  label,
  isFirst = false,
  isLast = false,
  columnWidths,
  sortBy,
  sortOrder,
  onSort,
  onResizeStart,
}: ColumnHeaderProps) => {
  return (
    <>
      <div style={{ width: columnWidths[column] }}>
        <button
          onClick={() => onSort(column)}
          className={`
            flex items-center gap-2 h-full text-xs font-semibold text-text-muted
            uppercase tracking-[0.5px] bg-transparent border-none cursor-pointer
            hover:text-text transition-colors justify-start
            ${isFirst ? 'px-2.5' : 'pl-2.5'}
          `}
          style={{ width: isLast ? columnWidths[column] : columnWidths[column] - RESIZER_GAP }}
        >
          {label}
          <SortIcon sortBy={sortBy} sortOrder={sortOrder} column={column} />
        </button>
      </div>
      {!isLast && (
        <ColumnResizer column={column} columnWidths={columnWidths} onResizeStart={onResizeStart} />
      )}
    </>
  )
}

export const FileListHeader: React.FC<FileListHeaderProps> = ({
  columnWidths,
  sortBy,
  sortOrder,
  onSort,
  onResizeStart,
  isWebdav = false,
}) => {
  const { t } = useTranslation()

  return (
    <div
      data-file-list-header
      className="flex items-center h-8 border-b border-border bg-sidebar-bg shrink-0 select-none"
    >
      <ColumnHeader
        column="name"
        label={t('fileExplorerList.name')}
        isFirst
        columnWidths={columnWidths}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        onResizeStart={onResizeStart}
      />
      {!isWebdav && (
        <>
          <ColumnHeader
            column="permissions"
            label={t('fileExplorerList.permissions')}
            columnWidths={columnWidths}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={onSort}
            onResizeStart={onResizeStart}
          />
          <ColumnHeader
            column="owner"
            label={t('fileExplorerList.owner')}
            columnWidths={columnWidths}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={onSort}
            onResizeStart={onResizeStart}
          />
        </>
      )}
      <ColumnHeader
        column="size"
        label={t('fileExplorerList.size')}
        columnWidths={columnWidths}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        onResizeStart={onResizeStart}
      />
      <ColumnHeader
        column="modifyTime"
        label={t('fileExplorerList.dateModified')}
        isLast
        columnWidths={columnWidths}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        onResizeStart={onResizeStart}
      />
    </div>
  )
}

export default FileListHeader
