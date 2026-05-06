import React, { useState, useCallback, useRef } from 'react'
import { List } from 'react-window'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../../stores/sessionStore'
import { useUiStore } from '../../stores/uiStore'
import { useTransferQueue } from '../../hooks/useTransferQueue'
import { FileInfo } from '@shared/types'
import ConfirmDialog from '../dialogs/ConfirmDialog'
import InputDialog from '../dialogs/InputDialog'

interface FileListProps {
  sessionId: string
  currentPath: string
}

export const FileList: React.FC<FileListProps> = ({ sessionId, currentPath }) => {
  const { t } = useTranslation()
  const { sessions, updateCurrentPath, refreshCurrentDirectory } = useSessionStore()
  const { addToast } = useUiStore()
  const { download } = useTransferQueue()
  const session = sessions.find(s => s.id === sessionId)
  const listRef = useRef<any>(null)

  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileInfo | null>(null)
  const [hoveredFile, setHoveredFile] = useState<string | null>(null)

  const handleNavigate = useCallback(
    async (path: string) => {
      updateCurrentPath(sessionId, path)
      setSelectedFile(null)
    },
    [sessionId, updateCurrentPath]
  )

  const handleFileClick = useCallback(
    (file: FileInfo) => {
      if (file.type === 'directory') {
        const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`
        handleNavigate(newPath)
      } else {
        setSelectedFile(file)
      }
    },
    [currentPath, handleNavigate]
  )

  const handleDoubleClick = useCallback(
    (file: FileInfo) => {
      if (file.type === 'directory') {
        const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`
        handleNavigate(newPath)
      }
    },
    [currentPath, handleNavigate]
  )

  const handleParentDirectory = useCallback(() => {
    if (currentPath === '/') return
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
    handleNavigate(parentPath)
  }, [currentPath, handleNavigate])

  const handleDelete = async () => {
    if (!fileToDelete) return
    try {
      await window.electronAPI.delete(sessionId, `${currentPath}/${fileToDelete.name}`)
      addToast({ type: 'success', message: t('toast.deleteSuccess') })
      await refreshCurrentDirectory(sessionId)
    } catch (error) {
      addToast({
        type: 'error',
        message: `${t('toast.deleteFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
    setFileToDelete(null)
  }

  const handleRename = async (newName: string) => {
    if (!selectedFile) return
    const oldPath = `${currentPath}/${selectedFile.name}`
    const newPath = `${currentPath}/${newName}`
    try {
      await window.electronAPI.rename(sessionId, oldPath, newPath)
      addToast({ type: 'success', message: t('toast.renameSuccess') })
      await refreshCurrentDirectory(sessionId)
    } catch (error) {
      addToast({
        type: 'error',
        message: `${t('toast.renameFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
    setSelectedFile(null)
  }

  const handleDownload = async () => {
    if (!selectedFile || selectedFile.type === 'directory') return
    try {
      const result = await window.electronAPI.showSaveDialog({
        defaultPath: selectedFile.name,
      })
      if (result && !result.canceled && result.filePath) {
        await download(`${currentPath}/${selectedFile.name}`, result.filePath)
      }
    } catch (error) {
      addToast({
        type: 'error',
        message: `${t('toast.downloadFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '-'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp: number): string => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleDateString()
  }

  if (!session) return null

  if (session.isLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }}
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              opacity="0.25"
            />
            <path
              d="M12 2a10 10 0 0110 10"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {t('fileList.loading')}
          </span>
        </div>
      </div>
    )
  }

  if (session.error) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'rgba(241, 76, 76, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f14c4c"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3
            style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '4px' }}
          >
            Error
          </h3>
          <p style={{ fontSize: '12px', color: '#f14c4c' }}>{session.error}</p>
        </div>
        <button
          onClick={() => refreshCurrentDirectory(sessionId)}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: 'var(--accent)',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
          {t('fileList.retry')}
        </button>
      </div>
    )
  }

  const files = session.files || []

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--hover)',
        }}
      >
        <div
          style={{
            flex: 1,
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {t('fileList.name')}
        </div>
        <div
          style={{
            width: '80px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            textAlign: 'right',
          }}
        >
          {t('fileList.size')}
        </div>
        <div
          style={{
            width: '100px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            textAlign: 'right',
          }}
        >
          {t('fileList.dateModified')}
        </div>
        <div style={{ width: '100px' }} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {files.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
              >
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('fileList.empty')}</p>
          </div>
        ) : (
          <List ref={listRef} height={600} width="100%" itemCount={files.length} itemSize={40}>
            {({ index, style }) => {
              const file = files[index]
              const isHovered = hoveredFile === file.name
              const isSelected = selectedFile?.name === file.name

              return (
                <div
                  style={{
                    ...style,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--hover)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={() => setHoveredFile(file.name)}
                  onMouseLeave={() => setHoveredFile(null)}
                  onClick={() => handleFileClick(file)}
                  onDoubleClick={() => handleDoubleClick(file)}
                >
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      minWidth: 0,
                    }}
                  >
                    {file.type === 'directory' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#dcbb14" stroke="none">
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                      </svg>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--text-muted)"
                        strokeWidth="1.5"
                      >
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    )}
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.name}
                    </span>
                  </div>
                  <div
                    style={{
                      width: '80px',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      textAlign: 'right',
                    }}
                  >
                    {file.type === 'file' ? formatFileSize(file.size) : '-'}
                  </div>
                  <div
                    style={{
                      width: '100px',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      textAlign: 'right',
                    }}
                  >
                    {formatDate(file.modifyTime)}
                  </div>
                  <div
                    style={{
                      width: '100px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                      opacity: isHovered ? 1 : 0,
                    }}
                  >
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setSelectedFile(file)
                        setRenameDialogOpen(true)
                      }}
                      style={{
                        padding: '4px',
                        borderRadius: '4px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      title={t('toolbar.rename')}
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
                    </button>
                    {file.type === 'file' && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          handleDownload()
                        }}
                        style={{
                          padding: '4px',
                          borderRadius: '4px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        title={t('toolbar.download')}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setSelectedFile(file)
                        setFileToDelete(file)
                        setDeleteDialogOpen(true)
                      }}
                      style={{
                        padding: '4px',
                        borderRadius: '4px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#f14c4c',
                      }}
                      onMouseEnter={e =>
                        (e.currentTarget.style.backgroundColor = 'rgba(241, 76, 76, 0.1)')
                      }
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      title={t('toolbar.delete')}
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
                    </button>
                  </div>
                </div>
              )
            }}
          </List>
        )}
      </div>

      {currentPath !== '/' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            onClick={handleParentDirectory}
            style={{
              padding: '6px 14px',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
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
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t('fileList.parentDirectory')}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false)
          setFileToDelete(null)
        }}
        onConfirm={handleDelete}
        title={t('dialog.delete.title')}
        message={t('dialog.delete.message', { name: fileToDelete?.name })}
        type="danger"
      />

      <InputDialog
        open={renameDialogOpen}
        onClose={() => {
          setRenameDialogOpen(false)
          setSelectedFile(null)
        }}
        onSubmit={handleRename}
        title={t('dialog.rename.title')}
        placeholder={t('dialog.rename.placeholder')}
        defaultValue={selectedFile?.name || ''}
      />
    </div>
  )
}

export default FileList
