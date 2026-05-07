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
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        style={{ transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }}
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
      style={{
        width: '6px',
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <div
        style={{
          width: '2px',
          height: '16px',
          backgroundColor: 'var(--text-muted)',
          opacity: 0.5,
          borderRadius: '1px',
        }}
      />
    </div>
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--hover)',
        flexShrink: 0,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <div style={{ width: columnWidths.name, display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => onSort('name')}
          style={{
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          {t('fileList.name')}
          <SortIcon column="name" />
        </button>
      </div>
      <ColumnResizer column="name" />
      <div style={{ width: columnWidths.permissions, paddingLeft: '10px' }}>
        <button
          onClick={() => onSort('permissions')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          {t('fileList.permissions')}
          <SortIcon column="permissions" />
        </button>
      </div>
      <ColumnResizer column="permissions" />
      <div style={{ width: columnWidths.owner, paddingLeft: '10px' }}>
        <button
          onClick={() => onSort('owner')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          {t('fileList.owner')}
          <SortIcon column="owner" />
        </button>
      </div>
      <ColumnResizer column="owner" />
      <div style={{ width: columnWidths.size, paddingLeft: '10px' }}>
        <button
          onClick={() => onSort('size')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          {t('fileList.size')}
          <SortIcon column="size" />
        </button>
      </div>
      <ColumnResizer column="size" />
      <div style={{ width: columnWidths.modifyTime, paddingLeft: '10px' }}>
        <button
          onClick={() => onSort('modifyTime')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          {t('fileList.dateModified')}
          <SortIcon column="modifyTime" />
        </button>
      </div>
    </div>
  )
}

export default FileListHeader
