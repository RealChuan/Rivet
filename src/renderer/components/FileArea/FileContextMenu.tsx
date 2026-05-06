import React from 'react'
import { useTranslation } from 'react-i18next'
import { FileInfo } from '@shared/types'

interface FileContextMenuProps {
  x: number
  y: number
  files: FileInfo[]
  isEmptyArea: boolean
  onClose: () => void
  onCreateFolder: () => void
  onRename: (file: FileInfo) => void
  onDelete: (file: FileInfo) => void
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  x,
  y,
  files,
  isEmptyArea,
  onClose,
  onCreateFolder,
  onRename,
  onDelete,
}) => {
  const { t } = useTranslation()

  return (
    <div
      style={{
        position: 'fixed',
        top: y,
        left: x,
        backgroundColor: 'var(--bg)',
        borderRadius: '6px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        border: '1px solid var(--border)',
        padding: '4px',
        zIndex: 1000,
        minWidth: '140px',
      }}
    >
      {isEmptyArea ? (
        <button
          onClick={() => {
            onCreateFolder()
            onClose()
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            textAlign: 'left',
            fontSize: '12px',
            color: 'var(--text)',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 4v16m8-8H4" />
          </svg>
          {t('fileList.newFolder')}
        </button>
      ) : files.length === 1 ? (
        <>
          <button
            onClick={() => {
              onRename(files[0])
              onClose()
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              textAlign: 'left',
              fontSize: '12px',
              color: 'var(--text)',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            {t('toolbar.rename')}
          </button>
          <div
            style={{
              height: '1px',
              backgroundColor: 'var(--border)',
              margin: '4px 0',
            }}
          />
          <button
            onClick={() => {
              onDelete(files[0])
              onClose()
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              textAlign: 'left',
              fontSize: '12px',
              color: '#f14c4c',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(241, 76, 76, 0.1)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            {t('toolbar.delete')}
          </button>
        </>
      ) : (
        <button
          onClick={() => {
            onDelete(files[0])
            onClose()
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            textAlign: 'left',
            fontSize: '12px',
            color: '#f14c4c',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(241, 76, 76, 0.1)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          {t('toolbar.delete')} ({files.length})
        </button>
      )}
    </div>
  )
}

export default FileContextMenu
