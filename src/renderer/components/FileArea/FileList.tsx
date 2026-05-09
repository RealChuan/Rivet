import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../../stores/sessionStore'
import { FileInfo } from '@shared/types'
import ConfirmDialog from '../dialogs/ConfirmDialog'
import InputDialog from '../dialogs/InputDialog'
import TargetFolderDialog from '../dialogs/TargetFolderDialog'
import ConflictDialog from '../dialogs/ConflictDialog'
import FileListHeader from './FileListHeader'
import FileItem from './FileItem'
import FileContextMenu from './FileContextMenu'
import { FileListLoading, FileListError, FileListEmpty } from './FileListStates'
import ParentDirectoryButton from './ParentDirectoryButton'
import VirtualList from '../VirtualList'
import { useFileOperations } from '../../hooks/useFileOperations'
import { formatFileSize, formatDate, getParentPath } from '../../utils/utils'

interface FileListProps {
  sessionId: string
  currentPath: string
}

export const FileList: React.FC<FileListProps> = ({ sessionId, currentPath }) => {
  const { t } = useTranslation()
  const { sessions, updateCurrentPath, refreshCurrentDirectory } = useSessionStore()
  const session = sessions.find(s => s.id === sessionId)
  const containerRef = useRef<HTMLDivElement>(null)

  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileInfo[] | null>(null)
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)
  const [hoveredFile, setHoveredFile] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'permissions' | 'owner' | 'size' | 'modifyTime'>(
    'name'
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [columnWidths, setColumnWidths] = useState({
    name: 200,
    permissions: 100,
    owner: 100,
    size: 100,
    modifyTime: 100,
  })
  const [hasUserResized, setHasUserResized] = useState(false)
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

  const [isDragging, setIsDragging] = useState(false)
  const [hasStartedDrag, setHasStartedDrag] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 })
  const [pendingSelection, setPendingSelection] = useState<Set<string>>(new Set())

  const {
    handleDelete,
    handleRename,
    handleCreateFolder,
    handleCopy,
    handleMove,
    handleSelectTargetFolder,
    handleConflictResolution,
    targetFolderDialogOpen,
    conflictDialogOpen,
    conflicts,
    pendingOperation,
    pendingFiles,
    pendingTargetDir,
    setTargetFolderDialogOpen,
  } = useFileOperations(sessionId)

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

  const handleDoubleClick = useCallback(
    (file: FileInfo) => {
      if (file.type === 'directory') {
        handleNavigate(file.absolutePath)
      }
    },
    [handleNavigate]
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
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          files: isSelected ? selectedFiles : [file],
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
    handleNavigate(getParentPath(currentPath))
  }, [currentPath, handleNavigate])

  const handleRenameWrapper = useCallback(
    async (newName: string) => {
      if (selectedFile) {
        await handleRename(selectedFile, newName)
        setSelectedFile(null)
      }
    },
    [selectedFile, handleRename]
  )

  const handleCreateFolderWrapper = useCallback(
    async (folderName: string) => {
      await handleCreateFolder(currentPath, folderName)
    },
    [currentPath, handleCreateFolder]
  )

  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver(entries => {
      for (const _entry of entries) {
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsDragging(true)
    setHasStartedDrag(false)
    setDragStart({ x, y })
    setDragEnd({ x, y })
    setPendingSelection(new Set())
  }, [])

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))

      setDragEnd({ x, y })

      const startX = Math.min(dragStart.x, x)
      const startY = Math.min(dragStart.y, y)
      const endX = Math.max(dragStart.x, x)
      const endY = Math.max(dragStart.y, y)

      const minDragDistance = 5
      const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))

      if (distance < minDragDistance) {
        return
      }

      if (!hasStartedDrag) {
        setHasStartedDrag(true)
        setSelectedFiles([])
        setSelectedFile(null)
      }

      const fileElements = containerRef.current.querySelectorAll('[data-file-item]')
      const newPendingSelection = new Set<string>()

      fileElements.forEach(el => {
        const fileRect = el.getBoundingClientRect()
        const containerRect = containerRef.current!.getBoundingClientRect()

        const fileLeft = fileRect.left - containerRect.left
        const fileTop = fileRect.top - containerRect.top
        const fileRight = fileLeft + fileRect.width
        const fileBottom = fileTop + fileRect.height

        if (fileRight > startX && fileLeft < endX && fileBottom > startY && fileTop < endY) {
          const fileName = el.getAttribute('data-file-item')
          if (fileName) {
            newPendingSelection.add(fileName)
          }
        }
      })

      setPendingSelection(newPendingSelection)
    },
    [isDragging, dragStart, hasStartedDrag]
  )

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
        const currentIndex = sortedFiles.findIndex(f => f.name === file.name)
        const lastSelectedIndex = sortedFiles.findIndex(
          f => f.name === selectedFiles[selectedFiles.length - 1].name
        )
        const start = Math.min(currentIndex, lastSelectedIndex)
        const end = Math.max(currentIndex, lastSelectedIndex)
        const range = sortedFiles.slice(start, end + 1)
        setSelectedFiles(range)
      } else {
        setSelectedFiles([file])
      }
      setSelectedFile(file)
      setPendingSelection(new Set())
    },
    [selectedFiles, sortedFiles]
  )

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return

    if (!hasStartedDrag) {
      setIsDragging(false)
      return
    }

    const startX = Math.min(dragStart.x, dragEnd.x)
    const startY = Math.min(dragStart.y, dragEnd.y)
    const endX = Math.max(dragStart.x, dragEnd.x)
    const endY = Math.max(dragStart.y, dragEnd.y)

    const selectedInBox: FileInfo[] = []
    const fileElements = containerRef.current?.querySelectorAll('[data-file-item]')

    fileElements?.forEach(el => {
      const fileRect = el.getBoundingClientRect()
      const containerRect = containerRef.current!.getBoundingClientRect()

      const fileLeft = fileRect.left - containerRect.left
      const fileTop = fileRect.top - containerRect.top
      const fileRight = fileLeft + fileRect.width
      const fileBottom = fileTop + fileRect.height

      if (fileRight > startX && fileLeft < endX && fileBottom > startY && fileTop < endY) {
        const fileName = el.getAttribute('data-file-item')
        if (fileName) {
          const file = sortedFiles.find(f => f.name === fileName)
          if (file) {
            selectedInBox.push(file)
          }
        }
      }
    })

    setSelectedFiles(selectedInBox)
    if (selectedInBox.length > 0) {
      setSelectedFile(selectedInBox[selectedInBox.length - 1])
    }

    setIsDragging(false)
    setHasStartedDrag(false)
    setPendingSelection(new Set())
  }, [isDragging, hasStartedDrag, dragStart, dragEnd, sortedFiles])

  const handleSort = (column: 'name' | 'permissions' | 'owner' | 'size' | 'modifyTime') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const handleResizeStart = (column: string, x: number, width: number) => {
    setHasUserResized(true)
    setResizingColumn(column)
    setResizeStartX(x)
    setResizeStartWidth(width)
  }

  useEffect(() => {
    if (!containerRef.current) return

    const containerWidth = containerRef.current.offsetWidth
    const fixedColumnsWidth = 100
    const numFixedColumns = 4
    const gapWidth = 6
    const numGaps = 5

    const totalFixedWidth = fixedColumnsWidth * numFixedColumns + gapWidth * numGaps
    const nameWidth = Math.max(200, containerWidth - totalFixedWidth)

    setColumnWidths({
      name: nameWidth,
      permissions: fixedColumnsWidth,
      owner: fixedColumnsWidth,
      size: fixedColumnsWidth,
      modifyTime: fixedColumnsWidth,
    })
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const handleResize = () => {
      if (hasUserResized) return

      const containerWidth = containerRef.current!.offsetWidth
      const fixedColumnsWidth = 100
      const numFixedColumns = 4
      const gapWidth = 6
      const numGaps = 5

      const totalFixedWidth = fixedColumnsWidth * numFixedColumns + gapWidth * numGaps
      const nameWidth = Math.max(200, containerWidth - totalFixedWidth)

      setColumnWidths({
        name: nameWidth,
        permissions: fixedColumnsWidth,
        owner: fixedColumnsWidth,
        size: fixedColumnsWidth,
        modifyTime: fixedColumnsWidth,
      })
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [hasUserResized])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove)
      document.addEventListener('mouseup', handleDragEnd)
      return () => {
        document.removeEventListener('mousemove', handleDragMove)
        document.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  useEffect(() => {
    if (session.isLoading) return

    setHasUserResized(false)

    const updateWidths = () => {
      if (!containerRef.current) return

      const containerWidth = containerRef.current.offsetWidth
      const fixedColumnsWidth = 100
      const numFixedColumns = 4
      const gapWidth = 6
      const numGaps = 5

      const totalFixedWidth = fixedColumnsWidth * numFixedColumns + gapWidth * numGaps
      const nameWidth = Math.max(200, containerWidth - totalFixedWidth)

      setColumnWidths({
        name: nameWidth,
        permissions: fixedColumnsWidth,
        owner: fixedColumnsWidth,
        size: fixedColumnsWidth,
        modifyTime: fixedColumnsWidth,
      })
    }

    requestAnimationFrame(updateWidths)
  }, [sessionId, session.isLoading])

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
    <div className="flex flex-col h-full" style={{ width: '100%', minWidth: totalWidth }}>
      <FileListHeader
        columnWidths={columnWidths}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onResizeStart={handleResizeStart}
      />

      <div
        ref={containerRef}
        className="flex-1 min-h-10 relative overflow-y-auto"
        onContextMenu={e => {
          const target = e.target as HTMLElement
          if (target === containerRef.current) {
            handleContextMenu(e)
          }
        }}
        onMouseDown={handleMouseDown}
      >
        {isDragging && hasStartedDrag && (
          <div
            className="absolute pointer-events-none z-100 rounded-sm border-[1.5px] border-accent bg-[rgba(59,130,246,0.1)]"
            style={{
              left: Math.min(dragStart.x, dragEnd.x),
              top: Math.min(dragStart.y, dragEnd.y),
              width: Math.abs(dragEnd.x - dragStart.x),
              height: Math.abs(dragEnd.y - dragStart.y),
            }}
          />
        )}
        {sortedFiles.length === 0 ? (
          <FileListEmpty />
        ) : (
          <VirtualList
            items={sortedFiles}
            itemHeight={40}
            width="100%"
            renderItem={(file, _index, style) => (
              <FileItem
                key={file.name}
                file={file}
                columnWidths={columnWidths}
                isSelected={selectedFiles.some(f => f.name === file.name)}
                isPending={pendingSelection.has(file.name)}
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
                style={style}
              />
            )}
          />
        )}
      </div>

      <ParentDirectoryButton currentPath={currentPath} onNavigate={handleParentDirectory} />

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false)
          setFileToDelete(null)
        }}
        onConfirm={() => {
          if (fileToDelete) {
            handleDelete(fileToDelete)
            setFileToDelete(null)
          }
        }}
        title={t('dialog.delete.title')}
        message={
          fileToDelete && fileToDelete.length > 1
            ? t('dialog.delete.messageMultiple', { count: fileToDelete.length })
            : t('dialog.delete.message', { name: fileToDelete?.[0]?.name })
        }
        type="danger"
      />

      <InputDialog
        open={renameDialogOpen}
        onClose={() => {
          setRenameDialogOpen(false)
          setSelectedFile(null)
        }}
        onSubmit={handleRenameWrapper}
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
          onCreateFolder={() => setNewFolderDialogOpen(true)}
          onRename={file => {
            setSelectedFile(file)
            setRenameDialogOpen(true)
          }}
          onDelete={files => {
            setFileToDelete(files)
            setDeleteDialogOpen(true)
          }}
          onCopy={handleCopy}
          onMove={handleMove}
        />
      )}

      <InputDialog
        open={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        onSubmit={handleCreateFolderWrapper}
        title={t('dialog.newFolder.title')}
        placeholder={t('dialog.newFolder.placeholder')}
        defaultValue=""
      />

      <TargetFolderDialog
        open={targetFolderDialogOpen}
        onClose={() => {
          setTargetFolderDialogOpen(false)
        }}
        onConfirm={handleSelectTargetFolder}
        sessionId={sessionId}
      />

      <ConflictDialog
        open={conflictDialogOpen}
        onClose={() => {
          setTargetFolderDialogOpen(false)
        }}
        onConfirm={handleConflictResolution}
        conflicts={conflicts}
        operation={pendingOperation ?? undefined}
        files={pendingFiles}
        targetDir={pendingTargetDir}
      />
    </div>
  )
}

export default FileList
