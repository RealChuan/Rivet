import React, { useEffect, useRef } from 'react'
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
  onDelete: (files: FileInfo[]) => void
  onCopy: (files: FileInfo[]) => void
  onMove: (files: FileInfo[]) => void
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
  onCopy,
  onMove,
}) => {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    backgroundColor: 'var(--bg)',
    borderRadius: '6px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    border: '1px solid var(--border)',
    padding: '4px',
    minWidth: '160px',
    zIndex: 1000,
  }

  const itemStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    textAlign: 'left' as const,
    fontSize: '12px',
    color: 'var(--text)',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const separatorStyle: React.CSSProperties = {
    height: '1px',
    backgroundColor: 'var(--border)',
    margin: '4px 0',
  }

  const handleItemClick = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div ref={menuRef} style={menuStyle}>
      {isEmptyArea ? (
        <button
          style={itemStyle}
          onClick={() => handleItemClick(onCreateFolder)}
          onMouseEnter={e =>
            ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--hover)')
          }
          onMouseLeave={e =>
            ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
          }
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
      ) : (
        <>
          <button
            style={itemStyle}
            onClick={() => handleItemClick(() => onCopy(files))}
            onMouseEnter={e =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--hover)')
            }
            onMouseLeave={e =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
            }
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            {t('toolbar.copy')} {files.length > 1 ? `(${files.length})` : ''}
          </button>
          <button
            style={itemStyle}
            onClick={() => handleItemClick(() => onMove(files))}
            onMouseEnter={e =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--hover)')
            }
            onMouseLeave={e =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
            }
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            {t('toolbar.move')} {files.length > 1 ? `(${files.length})` : ''}
          </button>
          {files.length === 1 && (
            <>
              <div style={separatorStyle} />
              <button
                style={itemStyle}
                onClick={() => handleItemClick(() => onRename(files[0]))}
                onMouseEnter={e =>
                  ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--hover)')
                }
                onMouseLeave={e =>
                  ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
                }
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
            </>
          )}
          <div style={separatorStyle} />
          <button
            style={{ ...itemStyle, color: '#f14c4c' }}
            onClick={() => handleItemClick(() => onDelete(files))}
            onMouseEnter={e =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(241, 76, 76, 0.1)')
            }
            onMouseLeave={e =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
            }
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
            {t('toolbar.delete')} {files.length > 1 ? `(${files.length})` : ''}
          </button>
        </>
      )}
    </div>
  )
}

export default FileContextMenu
