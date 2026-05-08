import React from 'react'
import { FileInfo } from '@shared/types'

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
  formatFileSize: (bytes: number) => string
  formatDate: (timestamp: number) => string
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
  formatFileSize,
  formatDate,
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

  return (
    <div
      key={file.name}
      data-file-item={file.name}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        height: '40px',
        cursor: 'pointer',
        backgroundColor: isSelected
          ? 'var(--selected)'
          : isPending
            ? 'var(--selected)'
            : isHovered
              ? 'var(--hover)'
              : 'transparent',
        color: isSelected ? 'var(--accent)' : 'var(--text)',
        borderBottom: '1px solid var(--border)',
        minWidth: totalWidth,
        boxSizing: 'border-box',
        position: 'relative',
        transition: 'background-color 0.10s ease, color 0.10s ease',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onMouseEnter={() => onHover(file.name)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div
        style={{
          width: columnWidths.name,
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minWidth: 0,
          height: '100%',
        }}
        title={nameContent}
      >
        {file.type === 'directory' ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={isSelected ? 'var(--accent)' : 'var(--warning)'}
            stroke="none"
          >
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isSelected ? 'var(--accent)' : 'var(--text-muted)'}
            strokeWidth="1.5"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        )}
        <span
          style={{
            fontSize: '14px',
            color: isSelected ? 'var(--accent)' : 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {file.name}
        </span>
      </div>
      <div style={{ width: '6px' }} />
      <div
        style={{
          width: columnWidths.permissions,
          paddingLeft: '10px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          textAlign: 'left',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
        title={permissionsContent}
      >
        {file.permissions || '-'}
      </div>
      <div style={{ width: '6px' }} />
      <div
        style={{
          width: columnWidths.owner,
          paddingLeft: '10px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          textAlign: 'left',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
        title={ownerContent}
      >
        {file.owner || '-'}
      </div>
      <div style={{ width: '6px' }} />
      <div
        style={{
          width: columnWidths.size,
          paddingLeft: '10px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          textAlign: 'left',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
        title={sizeContent}
      >
        {file.type === 'file' ? formatFileSize(file.size || 0) : '-'}
      </div>
      <div style={{ width: '6px' }} />
      <div
        style={{
          width: columnWidths.modifyTime,
          paddingLeft: '10px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          textAlign: 'left',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
        title={modifyTimeContent}
      >
        {formatDate(file.modifyTime || 0)}
      </div>
    </div>
  )
}

export default FileItem
