import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FileInfo } from '../../../shared/types.js'

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

  const menuClass = `
    fixed bg-bg rounded-md shadow-lg border border-border
    p-1 min-w-[160px] z-[1000]
  `

  const itemClass = `
    w-full px-3 py-2 text-left text-xs text-text
    bg-transparent border-none rounded cursor-pointer
    flex items-center gap-2 hover:bg-hover transition-colors
  `

  const separatorClass = 'h-px bg-border my-1'

  const handleItemClick = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div ref={menuRef} className={menuClass} style={{ left: x, top: y }}>
      {isEmptyArea ? (
        <button className={itemClass} onClick={() => handleItemClick(onCreateFolder)}>
          <svg className="w-3.5 h-3.5 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
            <path d="M12 4v16m8-8H4" />
          </svg>
          {t('fileList.newFolder')}
        </button>
      ) : (
        <>
          <button className={itemClass} onClick={() => handleItemClick(() => onCopy(files))}>
            <svg className="w-3.5 h-3.5 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            {t('toolbar.copy')} {files.length > 1 ? `(${files.length})` : ''}
          </button>
          <button className={itemClass} onClick={() => handleItemClick(() => onMove(files))}>
            <svg className="w-3.5 h-3.5 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            {t('toolbar.move')} {files.length > 1 ? `(${files.length})` : ''}
          </button>
          {files.length === 1 && (
            <>
              <div className={separatorClass} />
              <button
                className={itemClass}
                onClick={() => handleItemClick(() => onRename(files[0]))}
              >
                <svg
                  className="w-3.5 h-3.5 stroke-current stroke-2"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t('toolbar.rename')}
              </button>
            </>
          )}
          <div className={separatorClass} />
          <button
            className={`${itemClass} text-danger hover:bg-[rgba(241,76,76,0.1)]`}
            onClick={() => handleItemClick(() => onDelete(files))}
          >
            <svg className="w-3.5 h-3.5 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
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
