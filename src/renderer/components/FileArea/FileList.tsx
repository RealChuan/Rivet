import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../../stores/sessionStore'
import { useUiStore } from '../../stores/uiStore'
import { useTransferQueue } from '../../hooks/useTransferQueue'
import { FileInfo } from '@shared/types'
import ConfirmDialog from '../dialogs/ConfirmDialog'
import InputDialog from '../dialogs/InputDialog'
import FileListHeader from './FileListHeader'
import FileItem from './FileItem'
import FileContextMenu from './FileContextMenu'
import { FileListLoading, FileListError, FileListEmpty } from './FileListStates'

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
  const containerRef = useRef<HTMLDivElement>(null)

  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileInfo | null>(null)
  const [hoveredFile, setHoveredFile] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'permissions' | 'owner' | 'size' | 'modifyTime'>(
    'name'
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [columnWidths, setColumnWidths] = useState({
    name: 300,
    permissions: 100,
    owner: 100,
    size: 80,
    modifyTime: 100,
  })
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)

  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([])
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    files: FileInfo[]
    isEmptyArea: boolean
  } | null>(null)

  const handleNavigate = useCallback(
    async (path: string) => {
      updateCurrentPath(sessionId, path)
      setSelectedFile(null)
      await refreshCurrentDirectory(sessionId)
    },
    [sessionId, updateCurrentPath, refreshCurrentDirectory]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resizingColumn) return

      const deltaX = e.clientX - resizeStartX
      const newWidth = resizeStartWidth + deltaX

      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: Math.max(50, newWidth),
      }))
    },
    [resizingColumn, resizeStartX, resizeStartWidth]
  )

  const handleMouseUp = useCallback(() => {
    setResizingColumn(null)
  }, [])

  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [resizingColumn, handleMouseMove, handleMouseUp])

  const handleFileClick = useCallback(
    (file: FileInfo, e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setSelectedFiles(prev => {
          const exists = prev.find(f => f.name === file.name)
          if (exists) {
            return prev.filter(f => f.name !== file.name)
          }
          return [...prev, file]
        })
      } else if (e.shiftKey && selectedFiles.length > 0) {
        const files = safeGetFiles()
        const currentIndex = files.findIndex(f => f.name === file.name)
        const lastSelectedIndex = files.findIndex(
          f => f.name === selectedFiles[selectedFiles.length - 1].name
        )
        const start = Math.min(currentIndex, lastSelectedIndex)
        const end = Math.max(currentIndex, lastSelectedIndex)
        const range = files.slice(start, end + 1)
        setSelectedFiles(range)
      } else {
        setSelectedFiles([file])
      }
      setSelectedFile(file)
    },
    [selectedFiles]
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

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file?: FileInfo) => {
      e.preventDefault()
      if (file) {
        const isSelected = selectedFiles.some(f => f.name === file.name)
        if (!isSelected) {
          setSelectedFiles([file])
          setSelectedFile(file)
        }
        const files = isSelected ? selectedFiles : [file]
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          files,
          isEmptyArea: false,
        })
      } else {
        setSelectedFiles([])
        setSelectedFile(null)
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          files: [],
          isEmptyArea: true,
        })
      }
    },
    [selectedFiles]
  )

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  useEffect(() => {
    document.addEventListener('click', handleCloseContextMenu)
    return () => document.removeEventListener('click', handleCloseContextMenu)
  }, [handleCloseContextMenu])

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

  const handleCreateFolder = async () => {
    const defaultName = t('fileList.newFolderName') || 'New Folder'
    let folderName = defaultName
    let counter = 1

    const files = safeGetFiles()
    while (files.some(f => f.name === folderName)) {
      folderName = `${defaultName} ${counter}`
      counter++
    }

    const newPath = `${currentPath}/${folderName}`
    try {
      await window.electronAPI.mkdir(sessionId, newPath)
      addToast({ type: 'success', message: t('toast.createFolderSuccess') })
      await refreshCurrentDirectory(sessionId)
    } catch (error) {
      addToast({
        type: 'error',
        message: `${t('toast.createFolderFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
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

  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [])

  if (!session) return null

  const safeGetFiles = (): FileInfo[] => {
    if (!session || !session.files || !Array.isArray(session.files)) {
      return []
    }
    return session.files.filter(
      (file): file is FileInfo =>
        file &&
        typeof file === 'object' &&
        typeof file.name === 'string' &&
        (file.type === 'file' || file.type === 'directory')
    )
  }

  const files = safeGetFiles()

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      let result = 0
      switch (sortBy) {
        case 'name':
          result = a.name.localeCompare(b.name)
          break
        case 'permissions':
          result = (a.permissions || '').localeCompare(b.permissions || '')
          break
        case 'owner':
          result = (a.owner || '').localeCompare(b.owner || '')
          break
        case 'size':
          result = (a.size || 0) - (b.size || 0)
          break
        case 'modifyTime':
          result = (a.modifyTime || 0) - (b.modifyTime || 0)
          break
      }
      return sortOrder === 'asc' ? result : -result
    })
  }, [files, sortBy, sortOrder])

  const handleSort = (column: 'name' | 'permissions' | 'owner' | 'size' | 'modifyTime') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const handleResizeStart = (column: string, x: number, width: number) => {
    setResizingColumn(column)
    setResizeStartX(x)
    setResizeStartWidth(width)
  }

  if (session.isLoading) {
    return <FileListLoading />
  }

  if (session.error) {
    return (
      <FileListError error={session.error} onRetry={() => refreshCurrentDirectory(sessionId)} />
    )
  }

  const totalWidth =
    columnWidths.name +
    columnWidths.permissions +
    columnWidths.owner +
    columnWidths.size +
    columnWidths.modifyTime +
    24

  return (
    <div
      style={{
        minWidth: totalWidth,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <FileListHeader
        columnWidths={columnWidths}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onResizeStart={handleResizeStart}
      />

      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: '200px',
        }}
        onContextMenu={e => {
          const target = e.target as HTMLElement
          if (target === containerRef.current) {
            handleContextMenu(e)
          }
        }}
      >
        {sortedFiles.length === 0 ? (
          <FileListEmpty />
        ) : (
          sortedFiles.map(file => (
            <FileItem
              key={file.name}
              file={file}
              columnWidths={columnWidths}
              isSelected={selectedFiles.some(f => f.name === file.name)}
              isHovered={hoveredFile === file.name}
              onHover={setHoveredFile}
              onClick={e => handleFileClick(file, e)}
              onDoubleClick={() => handleDoubleClick(file)}
              onContextMenu={e => {
                e.stopPropagation()
                handleContextMenu(e, file)
              }}
              formatFileSize={formatFileSize}
              formatDate={formatDate}
            />
          ))
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

      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          files={contextMenu.files}
          isEmptyArea={contextMenu.isEmptyArea}
          onClose={handleCloseContextMenu}
          onCreateFolder={handleCreateFolder}
          onRename={file => {
            setSelectedFile(file)
            setRenameDialogOpen(true)
          }}
          onDelete={file => {
            setFileToDelete(file)
            setDeleteDialogOpen(true)
          }}
        />
      )}
    </div>
  )
}

export default FileList
