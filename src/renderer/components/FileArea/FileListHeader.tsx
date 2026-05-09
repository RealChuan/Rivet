import React from 'react'
import { useTranslation } from 'react-i18next'

interface ColumnWidths {
  name: number
  permissions: number
  owner: number
  size: number
  modifyTime: number
}

interface FileListHeaderProps {
  columnWidths: ColumnWidths
  sortBy: 'name' | 'permissions' | 'owner' | 'size' | 'modifyTime'
  sortOrder: 'asc' | 'desc'
  onSort: (column: 'name' | 'permissions' | 'owner' | 'size' | 'modifyTime') => void
  onResizeStart: (column: string, x: number, width: number) => void
}

export const FileListHeader: React.FC<FileListHeaderProps> = ({
  columnWidths,
  sortBy,
  sortOrder,
  onSort,
  onResizeStart,
}) => {
  const { t } = useTranslation()

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null
    return (
      <svg
        className={`
          w-2.5 h-2.5 stroke-accent stroke-2
          ${sortOrder === 'desc' ? 'rotate-180' : ''}
        `}
        viewBox="0 0 24 24"
        fill="none"
      >
        <polyline points="18 9 12 15 6 9" />
      </svg>
    )
  }

  const ColumnResizer = ({ column }: { column: string }) => (
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

  const HeaderButton = ({
    children,
    onClick,
    className = '',
  }: {
    children: React.ReactNode
    onClick: () => void
    className?: string
  }) => (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1 text-xs font-semibold text-text-muted
        uppercase tracking-[0.5px] bg-transparent border-none cursor-pointer
        hover:text-text transition-colors
        ${className}
      `}
    >
      {children}
    </button>
  )

  return (
    <div className="flex items-center py-2 border-b border-border bg-hover shrink-0 select-none">
      <div className="flex items-center" style={{ width: columnWidths.name }}>
        <HeaderButton onClick={() => onSort('name')} className="px-2.5">
          {t('fileList.name')}
          <SortIcon column="name" />
        </HeaderButton>
      </div>
      <ColumnResizer column="name" />
      <div className="pl-2.5" style={{ width: columnWidths.permissions }}>
        <HeaderButton onClick={() => onSort('permissions')}>
          {t('fileList.permissions')}
          <SortIcon column="permissions" />
        </HeaderButton>
      </div>
      <ColumnResizer column="permissions" />
      <div className="pl-2.5" style={{ width: columnWidths.owner }}>
        <HeaderButton onClick={() => onSort('owner')}>
          {t('fileList.owner')}
          <SortIcon column="owner" />
        </HeaderButton>
      </div>
      <ColumnResizer column="owner" />
      <div className="pl-2.5" style={{ width: columnWidths.size }}>
        <HeaderButton onClick={() => onSort('size')}>
          {t('fileList.size')}
          <SortIcon column="size" />
        </HeaderButton>
      </div>
      <ColumnResizer column="size" />
      <div className="pl-2.5" style={{ width: columnWidths.modifyTime }}>
        <HeaderButton onClick={() => onSort('modifyTime')}>
          {t('fileList.dateModified')}
          <SortIcon column="modifyTime" />
        </HeaderButton>
      </div>
    </div>
  )
}

export default FileListHeader
