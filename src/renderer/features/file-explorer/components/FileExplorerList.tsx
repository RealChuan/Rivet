import React, { useEffect } from 'react'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { useConnectionStore } from '@renderer/features/session/stores/connection.js'
import { type FileInfo } from '@shared/types/index.js'
import { PROTOCOL_WEBDAV } from '@shared/constants/index.js'
import FileListHeader from './FileListHeader.js'
import FileExplorerItem from './FileExplorerItem.js'
import FileExplorerDialogs from './FileExplorerDialogs.js'
import {
  FileExplorerListLoading,
  FileExplorerListError,
  FileExplorerListEmpty,
} from './FileListStates.js'
import ParentDirectoryButton from './ParentDirectoryButton.js'
import VirtualList from '@renderer/components/ui/VirtualList.js'
import {
  useFileDeletion,
  useFileRenaming,
  useFolderCreation,
  useFileCopyMove,
  useColumnResizing,
  useFileDragSelect,
  useFileListState,
  useFileSort,
  useDirectoryNavigation,
} from '@renderer/features/file-explorer/hooks/index.js'

interface FileExplorerListProps {
  sessionId: string
  currentPath: string
}

export const FileExplorerList: React.FC<FileExplorerListProps> = ({ sessionId, currentPath }) => {
  const sessions = useSessionStore(state => state.sessions)
  const updateCurrentPath = useSessionStore(state => state.updateCurrentPath)
  const refreshCurrentDirectory = useSessionStore(state => state.refreshCurrentDirectory)
  const connections = useConnectionStore(state => state.connections)
  const session = sessions.find(s => s.sessionId === sessionId)
  const connection = connections.find(c => c.id === session?.connectionId)
  const isWebdav = connection?.protocol === PROTOCOL_WEBDAV

  const {
    selectedFile,
    selectedFiles,
    setSelectedFile,
    setSelectedFiles,
    deleteDialogOpen,
    renameDialogOpen,
    fileToDelete,
    newFolderDialogOpen,
    setNewFolderDialogOpen,
    hoveredFile,
    setHoveredFile,
    contextMenu,
    handleSelectFile,
    handleMultiSelect,
    clearSelection,
    openDeleteDialog,
    closeDeleteDialog,
    openRenameDialog,
    closeRenameDialog,
    openContextMenu,
    closeContextMenu,
  } = useFileListState()

  const { columnWidths, actualColumnWidths, handleResizeStart, containerRef, resetColumnWidths } =
    useColumnResizing({ isWebdav })
  const files = session?.files ?? []
  const { sortBy, sortOrder, sortedFiles, handleSort } = useFileSort(files)
  const { handleDoubleClick, handleParentDirectory } = useDirectoryNavigation(
    sessionId,
    currentPath,
    updateCurrentPath,
    refreshCurrentDirectory,
    clearSelection
  )

  const { dragSelection, isDragging, hasStartedDrag, handleMouseDown, getDragStyle } =
    useFileDragSelect({
      items: sortedFiles,
      itemHeight: 40,
      headerHeight: 32,
      containerRef,
      onDragStart: () => {
        clearSelection()
      },
      onDragSelect: selected => {
        if (selected.length > 0) {
          setSelectedFiles(selected)
          setSelectedFile(selected[selected.length - 1] ?? null)
        } else {
          clearSelection()
        }
      },
    })

  const { handleDelete } = useFileDeletion(sessionId)
  const { handleRename } = useFileRenaming(sessionId)
  const { handleCreateFolder } = useFolderCreation(sessionId)
  const fileCopyMoveState = useFileCopyMove(sessionId)

  const handleFileClick = (file: FileInfo, e: React.MouseEvent) => {
    if (isDragging) return

    const isCtrl = e.ctrlKey || e.metaKey
    const isShift = e.shiftKey

    if (isCtrl || isShift) {
      handleMultiSelect(file, isCtrl, isShift, sortedFiles)
    } else {
      handleSelectFile(file)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, file?: FileInfo) => {
    e.preventDefault()
    e.stopPropagation()

    if (file) {
      const isSelected = selectedFiles.some(f => f.name === file.name)
      if (!isSelected) {
        handleSelectFile(file)
      }
      openContextMenu(
        e.clientX,
        e.clientY,
        selectedFiles.length > 0 ? selectedFiles : [file],
        false
      )
    } else {
      clearSelection()
      openContextMenu(e.clientX, e.clientY, [], true)
    }
  }

  const handleRenameWrapper = (newName: string) => {
    if (selectedFile) {
      void handleRename(selectedFile, newName)
      closeRenameDialog()
    }
  }

  const handleCreateFolderWrapper = (folderName: string) => {
    void handleCreateFolder(currentPath, folderName)
  }

  useEffect(() => {
    if (!session?.isLoading) resetColumnWidths()
  }, [session?.isLoading, resetColumnWidths])

  useEffect(() => {
    const handleGlobalClick = () => closeContextMenu()
    document.addEventListener('click', handleGlobalClick)
    return () => document.removeEventListener('click', handleGlobalClick)
  }, [closeContextMenu])

  const renderFileExplorerItem = (file: FileInfo, _index: number, style: React.CSSProperties) => (
    <FileExplorerItem
      file={file}
      columnWidths={actualColumnWidths}
      isSelected={selectedFiles.some(f => f.name === file.name)}
      isPending={dragSelection.has(file.name)}
      isHovered={hoveredFile === file.name}
      onHover={setHoveredFile}
      onClick={e => handleFileClick(file, e)}
      onDoubleClick={() => handleDoubleClick(file)}
      onContextMenu={e => {
        e.stopPropagation()
        handleContextMenu(e, file)
      }}
      style={style}
      isWebdav={isWebdav}
    />
  )

  if (!session) return null

  // 首次加载（无旧数据）→ 骨架屏
  if (session.isLoading && files.length === 0) {
    return <FileExplorerListLoading />
  }

  // 有错误且无旧数据 → 错误状态
  if (session.error && files.length === 0) {
    return (
      <FileExplorerListError
        error={session.error}
        onRetry={() => void refreshCurrentDirectory(sessionId)}
      />
    )
  }

  const gapWidth = 6
  const numGaps = isWebdav ? 3 : 5
  const scrollbarWidth = containerRef.current
    ? containerRef.current.offsetWidth - containerRef.current.clientWidth
    : 0
  const totalWidth =
    columnWidths.name +
    columnWidths.permissions +
    columnWidths.owner +
    columnWidths.size +
    columnWidths.modifyTime +
    gapWidth * numGaps -
    scrollbarWidth

  return (
    <div className="flex flex-col h-full" style={{ width: '100%' }}>
      {/* 加载进度条 — 刷新/切换目录时保留旧数据，顶部显示进度条 */}
      {session.isLoading && files.length > 0 && (
        <div className="h-0.5 bg-accent/10 shrink-0 overflow-hidden">
          <div className="h-full bg-accent animate-[loading-bar_1.5s_ease-in-out_infinite]" />
        </div>
      )}
      <div
        ref={containerRef}
        className="flex-1 min-h-10 relative overflow-auto"
        onContextMenu={e => {
          const target = e.target as HTMLElement
          const fileItem = target.closest('[data-file-item]')
          if (!fileItem) {
            handleContextMenu(e)
          }
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex flex-col" style={{ minWidth: totalWidth, height: '100%' }}>
          <FileListHeader
            columnWidths={actualColumnWidths}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onResizeStart={handleResizeStart}
            isWebdav={isWebdav}
          />

          {isDragging && hasStartedDrag && (
            <div
              className="absolute pointer-events-none z-100 rounded-sm border-[1.5px] border-accent bg-accent-light"
              style={getDragStyle()}
            />
          )}
          {sortedFiles.length === 0 ? (
            <FileExplorerListEmpty />
          ) : (
            <VirtualList
              items={sortedFiles}
              itemHeight={40}
              width={totalWidth}
              renderItem={renderFileExplorerItem}
              overflowStyle={{ overflow: 'visible' }}
            />
          )}
        </div>
      </div>

      <ParentDirectoryButton currentPath={currentPath} onNavigate={handleParentDirectory} />

      <FileExplorerDialogs
        sessionId={sessionId}
        selectedFile={selectedFile}
        deleteDialogOpen={deleteDialogOpen}
        closeDeleteDialog={closeDeleteDialog}
        fileToDelete={fileToDelete}
        handleDelete={handleDelete}
        renameDialogOpen={renameDialogOpen}
        closeRenameDialog={closeRenameDialog}
        handleRenameWrapper={handleRenameWrapper}
        newFolderDialogOpen={newFolderDialogOpen}
        setNewFolderDialogOpen={setNewFolderDialogOpen}
        handleCreateFolderWrapper={handleCreateFolderWrapper}
        fileCopyMoveState={fileCopyMoveState}
        contextMenu={contextMenu}
        closeContextMenu={closeContextMenu}
        openDeleteDialog={openDeleteDialog}
        openRenameDialog={openRenameDialog}
      />
    </div>
  )
}

export default FileExplorerList
