import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@renderer/features/session/stores/sessionStore.js'
import { type FileInfo } from '@shared/types/index.js'
import ConfirmDialog from '@renderer/components/common/ConfirmDialog.js'
import InputDialog from '@renderer/components/common/InputDialog.js'
import TargetFolderDialog from './TargetFolderDialog.js'
import ConflictDialog from './ConflictDialog.js'
import FileListHeader from './FileListHeader.js'
import FileItem from './FileItem.js'
import FileContextMenu from './FileContextMenu.js'
import { FileListLoading, FileListError, FileListEmpty } from './FileListStates.js'
import ParentDirectoryButton from './ParentDirectoryButton.js'
import VirtualList from '@renderer/components/ui/VirtualList.js'
import { useFileOperations } from '@renderer/features/file-explorer/hooks/useFileOperations.js'
import { getParentPath } from '@shared/utils/index.js'

interface FileListProps {
  sessionId: string
  currentPath: string
}

export const FileList: React.FC<FileListProps> = ({ sessionId, currentPath }) => {
  const { t } = useTranslation()
  const { sessions, connections, updateCurrentPath, refreshCurrentDirectory } = useSessionStore()
  const session = sessions.find(s => s.sessionId === sessionId)
  const connection = connections.find(c => c.connectionUuid === session?.connectionUuid)
  const isWebdav = connection?.protocol === 'webdav'
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
    modifyTime: 150,
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
  const [pendingSelection, setPendingSelection] = useState<Set<string>>(new Set<string>())

  const isDraggingRef = useRef(isDragging)
  isDraggingRef.current = isDragging

  const hasStartedDragRef = useRef(hasStartedDrag)
  hasStartedDragRef.current = hasStartedDrag

  const dragStartRef = useRef(dragStart)
  dragStartRef.current = dragStart

  const dragEndRef = useRef(dragEnd)
  dragEndRef.current = dragEnd

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
    setConflictDialogOpen,
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
      const onMouseMove = (e: MouseEvent) => {
        handleMouseMove(e)
      }
      const onMouseUp = () => {
        handleMouseUp()
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      return () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
    }
  }, [resizingColumn, handleMouseMove, handleMouseUp])

  const handleDoubleClick = useCallback(
    (file: FileInfo) => {
      if (file.type === 'directory') {
        void handleNavigate(file.absolutePath)
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

  const handleCloseContextMenuRef = useRef(handleCloseContextMenu)
  handleCloseContextMenuRef.current = handleCloseContextMenu

  useEffect(() => {
    const handler = () => handleCloseContextMenuRef.current()
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const handleParentDirectory = useCallback(() => {
    if (currentPath === '/') return
    void handleNavigate(getParentPath(currentPath))
  }, [currentPath, handleNavigate])

  const handleRenameWrapper = useCallback(
    (newName: string) => {
      if (selectedFile) {
        void handleRename(selectedFile, newName)
        setSelectedFile(null)
      }
    },
    [selectedFile, handleRename]
  )

  const handleCreateFolderWrapper = useCallback(
    (folderName: string) => {
      void handleCreateFolder(currentPath, folderName)
    },
    [currentPath, handleCreateFolder]
  )

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
    setPendingSelection(new Set<string>())
  }, [])

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

  const calculateColumnWidths = useCallback(
    (containerWidth?: number) => {
      const width = containerWidth ?? containerRef.current?.offsetWidth
      if (!width) return

      const fixedColumnsWidth = 100
      const modifyTimeWidth = 150
      const gapWidth = 6

      const { numFixedColumns, numGaps, permissionsWidth, ownerWidth } = isWebdav
        ? { numFixedColumns: 1, numGaps: 3, permissionsWidth: 0, ownerWidth: 0 }
        : {
            numFixedColumns: 3,
            numGaps: 5,
            permissionsWidth: fixedColumnsWidth,
            ownerWidth: fixedColumnsWidth,
          }

      const totalFixedWidth =
        fixedColumnsWidth * numFixedColumns + modifyTimeWidth + gapWidth * numGaps
      const nameWidth = Math.max(200, width - totalFixedWidth)

      setColumnWidths({
        name: nameWidth,
        permissions: permissionsWidth,
        owner: ownerWidth,
        size: fixedColumnsWidth,
        modifyTime: modifyTimeWidth,
      })
    },
    [isWebdav]
  )

  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver(entries => {
      if (hasUserResized) return
      for (const entry of entries) {
        const width = (entry.target as HTMLElement).offsetWidth
        calculateColumnWidths(width)
      }
    })

    resizeObserver.observe(containerRef.current)

    requestAnimationFrame(() => {
      calculateColumnWidths(containerRef.current?.offsetWidth)
    })

    return () => resizeObserver.disconnect()
  }, [hasUserResized, calculateColumnWidths])

  useEffect(() => {
    if (!session) return

    if (session.isLoading) return

    setHasUserResized(false)
    requestAnimationFrame(() => {
      calculateColumnWidths(containerRef.current?.offsetWidth)
    })
  }, [session, sessionId, calculateColumnWidths])

  const files = useMemo(() => session?.files ?? [], [session?.files])

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
          result = (a.permissions ?? '').localeCompare(b.permissions ?? '')
          break
        case 'owner':
          result = (a.owner ?? '').localeCompare(b.owner ?? '')
          break
        case 'size':
          result = (a.size ?? 0) - (b.size ?? 0)
          break
        case 'modifyTime':
          result = (a.modifyTime ?? 0) - (b.modifyTime ?? 0)
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
          f => f.name === selectedFiles[selectedFiles.length - 1]?.name
        )
        const start = Math.min(currentIndex, lastSelectedIndex)
        const end = Math.max(currentIndex, lastSelectedIndex)
        const range = sortedFiles.slice(start, end + 1)
        setSelectedFiles(range)
      } else {
        setSelectedFiles([file])
      }
      setSelectedFile(file)
      setPendingSelection(new Set<string>())
    },
    [selectedFiles, sortedFiles]
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return

      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const scrollLeft = container.scrollLeft
      const scrollTop = container.scrollTop

      const x = e.clientX - rect.left + scrollLeft
      const y = e.clientY - rect.top + scrollTop

      const currentDragStart = dragStartRef.current
      const currentHasStartedDrag = hasStartedDragRef.current

      setDragEnd({ x, y })

      const startX = Math.min(currentDragStart.x, x)
      const startY = Math.min(currentDragStart.y, y)
      const endX = Math.max(currentDragStart.x, x)
      const endY = Math.max(currentDragStart.y, y)

      const minDragDistance = 5
      const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))

      if (distance < minDragDistance) {
        return
      }

      if (!currentHasStartedDrag) {
        setHasStartedDrag(true)
        setSelectedFiles([])
        setSelectedFile(null)
      }

      const fileElements = container.querySelectorAll('[data-file-item]')
      const newPendingSelection = new Set<string>()

      fileElements.forEach(el => {
        const fileRect = el.getBoundingClientRect()
        const fileLeft = fileRect.left - rect.left + scrollLeft
        const fileTop = fileRect.top - rect.top + scrollTop
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
    }

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return

      const currentHasStartedDrag = hasStartedDragRef.current
      const currentDragStart = dragStartRef.current
      const currentDragEnd = dragEndRef.current

      if (!currentHasStartedDrag) {
        setIsDragging(false)
        return
      }

      const startX = Math.min(currentDragStart.x, currentDragEnd.x)
      const startY = Math.min(currentDragStart.y, currentDragEnd.y)
      const endX = Math.max(currentDragStart.x, currentDragEnd.x)
      const endY = Math.max(currentDragStart.y, currentDragEnd.y)

      const selectedInBox: FileInfo[] = []
      const container = containerRef.current
      const fileElements = container?.querySelectorAll('[data-file-item]')
      const rect = container?.getBoundingClientRect()
      const scrollLeft = container?.scrollLeft ?? 0
      const scrollTop = container?.scrollTop ?? 0

      fileElements?.forEach(el => {
        const fileRect = el.getBoundingClientRect()
        const fileLeft = fileRect.left - (rect?.left ?? 0) + scrollLeft
        const fileTop = fileRect.top - (rect?.top ?? 0) + scrollTop
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
        setSelectedFile(selectedInBox[selectedInBox.length - 1] ?? null)
      }

      setIsDragging(false)
      setHasStartedDrag(false)
      setPendingSelection(new Set<string>())
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [sortedFiles])

  if (!session) return null

  if (session.isLoading) {
    return <FileListLoading />
  }

  if (session.error) {
    return (
      <FileListError
        error={session.error}
        onRetry={() => void refreshCurrentDirectory(sessionId)}
      />
    )
  }

  const gapWidth = 6
  const numGaps = isWebdav ? 3 : 5
  const totalWidth =
    columnWidths.name +
    columnWidths.permissions +
    columnWidths.owner +
    columnWidths.size +
    columnWidths.modifyTime +
    gapWidth * numGaps

  return (
    <div className="flex flex-col h-full" style={{ width: '100%', minWidth: totalWidth }}>
      <FileListHeader
        columnWidths={columnWidths}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onResizeStart={handleResizeStart}
        isWebdav={isWebdav}
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
                onDoubleClick={() => void handleDoubleClick(file)}
                onContextMenu={e => {
                  e.stopPropagation()
                  handleContextMenu(e, file)
                }}
                style={style}
                isWebdav={isWebdav}
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
            void handleDelete(fileToDelete)
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
        defaultValue={selectedFile?.name ?? ''}
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
        onConfirm={(targetDir: FileInfo) => void handleSelectTargetFolder(targetDir)}
        sessionId={sessionId}
      />

      <ConflictDialog
        open={conflictDialogOpen}
        onClose={() => {
          setConflictDialogOpen(false)
          setTargetFolderDialogOpen(false)
        }}
        onConfirm={handleConflictResolution}
        conflicts={conflicts}
        operation={pendingOperation as 'copy' | 'move'}
        files={pendingFiles}
        targetDir={pendingTargetDir ?? null}
      />
    </div>
  )
}

export default FileList
