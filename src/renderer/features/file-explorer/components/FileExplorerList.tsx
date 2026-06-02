import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import VirtualList from '@renderer/components/ui/VirtualList.js'
import {
  useColumnResizing,
  useDirectoryNavigation,
  useFileCopyMove,
  useFileDeletion,
  useFileDragSelect,
  useFileListState,
  useFileRenaming,
  useFileSort,
  useFolderCreation,
} from '@renderer/features/file-explorer/hooks/index.js'
import { useConnectionStore } from '@renderer/features/session/stores/connection.js'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { useTransferActions } from '@renderer/features/transfer/hooks/useTransferActions.js'
import { PROTOCOL } from '@shared/constants/index.js'
import { TRANSFER_ITEM_TYPE } from '@shared/constants/transfer.js'
import { type FileInfo, isOk } from '@shared/types/index.js'
import FileExplorerDialogs from './FileExplorerDialogs.js'
import FileExplorerItem from './FileExplorerItem.js'
import FileListHeader from './FileListHeader.js'
import {
  FileExplorerListEmpty,
  FileExplorerListError,
  FileExplorerListLoading,
} from './FileListStates.js'
import ParentDirectoryButton from './ParentDirectoryButton.js'

interface FileExplorerListProps {
  sessionId: string
  currentPath: string
}

export const FileExplorerList: React.FC<FileExplorerListProps> = ({ sessionId, currentPath }) => {
  const { t } = useTranslation()
  const sessions = useSessionStore(state => state.sessions)
  const updateCurrentPath = useSessionStore(state => state.updateCurrentPath)
  const refreshCurrentDirectory = useSessionStore(state => state.refreshCurrentDirectory)
  const connections = useConnectionStore(state => state.connections)
  const session = sessions.find(s => s.sessionId === sessionId)
  const connection = connections.find(c => c.id === session?.connectionId)
  const isWebdav = connection?.protocol === PROTOCOL.WEBDAV
  const { startUpload } = useTransferActions()
  const [isDragOver, setIsDragOver] = useState(false)

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
    if (hasStartedDrag) return

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

  const handleUploadFiles = useCallback(async () => {
    const downloadDirResult = await window.electronAPI.system.getDownloadDir()
    const defaultPath = downloadDirResult.success ? downloadDirResult.value : undefined
    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      defaultPath,
    })
    if (!isOk(result) || !result.value) return
    if (result.value.canceled || result.value.filePaths.length === 0) return
    await startUpload(result.value.filePaths, sessionId, currentPath, TRANSFER_ITEM_TYPE.FILE)
  }, [sessionId, currentPath, startUpload])

  const handleUploadFolder = useCallback(async () => {
    const downloadDirResult = await window.electronAPI.system.getDownloadDir()
    const defaultPath = downloadDirResult.success ? downloadDirResult.value : undefined
    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath,
    })
    if (!isOk(result) || !result.value) return
    if (result.value.canceled || result.value.filePaths.length === 0) return
    await startUpload(result.value.filePaths, sessionId, currentPath, TRANSFER_ITEM_TYPE.FOLDER)
  }, [sessionId, currentPath, startUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const filePaths: string[] = []
      const folderPaths: string[] = []

      for (const item of Array.from(e.dataTransfer.items)) {
        const entry = item.webkitGetAsEntry?.()
        const file = item.getAsFile()
        if (!file) continue

        const filePath = window.electronAPI.dialog.getPathForFile(file)
        if (!filePath) continue

        if (entry?.isDirectory) {
          folderPaths.push(filePath)
        } else {
          filePaths.push(filePath)
        }
      }

      if (filePaths.length === 0 && folderPaths.length === 0) return

      if (filePaths.length > 0) {
        void startUpload(filePaths, sessionId, currentPath, TRANSFER_ITEM_TYPE.FILE)
      }
      if (folderPaths.length > 0) {
        void startUpload(folderPaths, sessionId, currentPath, TRANSFER_ITEM_TYPE.FOLDER)
      }
    },
    [sessionId, currentPath, startUpload]
  )

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
  const totalWidth =
    columnWidths.name +
    columnWidths.permissions +
    columnWidths.owner +
    columnWidths.size +
    columnWidths.modifyTime +
    gapWidth * numGaps

  return (
    <div className="flex flex-col h-full" style={{ width: '100%' }}>
      {(session.isLoading || session.isOperating) && files.length > 0 && (
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
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-accent/5 border-2 border-dashed border-accent rounded pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-accent">
              <svg className="w-8 h-8 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-sm font-medium">{t('file.dropToUpload')}</span>
            </div>
          </div>
        )}
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
            <div className="flex-1 min-h-0">
              <VirtualList
                items={sortedFiles}
                itemHeight={40}
                width={totalWidth}
                renderItem={renderFileExplorerItem}
                overflowStyle={{ overflow: 'visible' }}
              />
            </div>
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
        onUploadFiles={() => void handleUploadFiles()}
        onUploadFolder={() => void handleUploadFolder()}
      />
    </div>
  )
}

export default FileExplorerList
