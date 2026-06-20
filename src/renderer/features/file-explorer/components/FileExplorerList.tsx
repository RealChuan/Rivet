import type React from 'react'
import type { ListImperativeAPI } from 'react-window'
import { Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import VirtualList from '@renderer/components/ui/VirtualList.js'
import { useFileExplorerTransferActions } from '@renderer/features/file-explorer/contexts/transfer-actions.js'
import {
  useColumnResizing,
  useDirectoryNavigation,
  useFileDragSelect,
  useFileListState,
  useFileSort,
} from '@renderer/features/file-explorer/hooks/index.js'
import { computeTotalWidth } from '@renderer/features/file-explorer/hooks/use-column-resizing.js'
import { useConnectionStore } from '@renderer/features/session/stores/connection.js'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { PROTOCOL, FILE_ITEM_HEIGHT } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
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
  onSelectedFilesChange?: (files: FileInfo[]) => void
}

export const FileExplorerList = ({
  sessionId,
  currentPath,
  onSelectedFilesChange,
}: FileExplorerListProps) => {
  const { t } = useTranslation()
  const sessions = useSessionStore((state) => state.sessions)
  const updateCurrentPath = useSessionStore((state) => state.updateCurrentPath)
  const refreshCurrentDirectory = useSessionStore((state) => state.refreshCurrentDirectory)
  const connections = useConnectionStore((state) => state.connections)
  const session = sessions.find((s) => s.sessionId === sessionId)
  const connection = connections.find((c) => c.id === session?.connectionId)
  const isSftp = connection?.protocol === PROTOCOL.SFTP
  const { startMixedUpload } = useFileExplorerTransferActions()
  const [isDragOver, setIsDragOver] = useState(false)

  const listState = useFileListState()
  const {
    selectedFiles,
    setSelectedFile,
    setSelectedFiles,
    hoveredFile,
    setHoveredFile,
    handleSelectFile,
    handleMultiSelect,
    handleSelectAll,
    clearSelection,
    openContextMenu,
    closeContextMenu,
  } = listState

  const { columnWidths, actualColumnWidths, handleResizeStart, containerRef, resetColumnWidths } =
    useColumnResizing({ isSftp })
  const files = session?.files ?? []
  const { sortBy, sortOrder, sortedFiles, handleSort } = useFileSort(files)
  const { handleDoubleClick, handleParentDirectory } = useDirectoryNavigation(
    sessionId,
    currentPath,
    updateCurrentPath,
    refreshCurrentDirectory,
    clearSelection,
  )

  const listRef = useRef<ListImperativeAPI>(null)
  const scrollContainerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (listRef.current) {
      scrollContainerRef.current = listRef.current.element
    }
  }, [])

  const { dragSelection, isDragging, hasStartedDrag, handleMouseDown, getDragStyle } =
    useFileDragSelect({
      items: sortedFiles,
      itemHeight: FILE_ITEM_HEIGHT,
      scrollContainerRef,
      onDragStart: () => {
        clearSelection()
      },
      onDragSelect: (selected) => {
        if (selected.length > 0) {
          setSelectedFiles(selected)
          setSelectedFile(selected[selected.length - 1] ?? null)
        } else {
          clearSelection()
        }
      },
    })

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
      const isSelected = selectedFiles.some((f) => f.name === file.name)
      if (!isSelected) {
        handleSelectFile(file)
      }
      openContextMenu(e.clientX, e.clientY, isSelected ? selectedFiles : [file], false)
    } else {
      clearSelection()
      openContextMenu(e.clientX, e.clientY, [], true)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
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

    if (filePaths.length > 0 || folderPaths.length > 0) {
      void startMixedUpload(filePaths, folderPaths, sessionId, currentPath)
    }
  }

  useEffect(() => {
    if (!session?.isLoading) resetColumnWidths()
  }, [session?.isLoading, resetColumnWidths])

  useEffect(() => {
    onSelectedFilesChange?.(selectedFiles)
  }, [selectedFiles, onSelectedFilesChange])

  useEffect(() => {
    const handleGlobalClick = () => closeContextMenu()
    document.addEventListener('click', handleGlobalClick)
    return () => document.removeEventListener('click', handleGlobalClick)
  }, [closeContextMenu])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        handleSelectAll(sortedFiles)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSelectAll, sortedFiles])

  const renderFileExplorerItem = (file: FileInfo, _index: number, style: React.CSSProperties) => (
    <FileExplorerItem
      file={file}
      columnWidths={actualColumnWidths}
      isSelected={selectedFiles.some((f) => f.name === file.name)}
      isPending={dragSelection.has(file.name)}
      isHovered={hoveredFile === file.name}
      onHover={setHoveredFile}
      onClick={(e) => handleFileClick(file, e)}
      onDoubleClick={() => handleDoubleClick(file)}
      onContextMenu={(e) => {
        e.stopPropagation()
        handleContextMenu(e, file)
      }}
      style={style}
      isSftp={isSftp}
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

  const totalWidth = computeTotalWidth(columnWidths, isSftp)

  return (
    <div className="flex flex-col h-full" style={{ width: '100%' }}>
      {(session.isLoading || session.isOperating) && files.length > 0 && (
        <div className="h-0.5 bg-accent/10 shrink-0 overflow-hidden">
          <div className="h-full bg-accent animate-progress-indeterminate" />
        </div>
      )}
      <div
        ref={containerRef}
        className="flex-1 min-h-10 relative overflow-hidden"
        onContextMenu={(e) => {
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
              <Upload className="w-8 h-8 stroke-current stroke-2" />
              <span className="text-sm font-medium">{t(($) => $.file.dropToUpload)}</span>
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
            isSftp={isSftp}
          />

          {sortedFiles.length === 0 ? (
            <FileExplorerListEmpty />
          ) : (
            <div className="flex-1 min-h-0">
              <VirtualList
                items={sortedFiles}
                itemHeight={FILE_ITEM_HEIGHT}
                width={totalWidth}
                renderItem={renderFileExplorerItem}
                listRef={listRef}
              >
                {isDragging && hasStartedDrag && (
                  <div
                    className="absolute pointer-events-none z-100 rounded-sm border-[1.5px] border-accent bg-accent-light"
                    style={getDragStyle()}
                  />
                )}
              </VirtualList>
            </div>
          )}
        </div>
      </div>

      <ParentDirectoryButton currentPath={currentPath} onNavigate={handleParentDirectory} />

      <FileExplorerDialogs
        sessionId={sessionId}
        currentPath={currentPath}
        listState={listState}
        isSftp={isSftp}
      />
    </div>
  )
}

export default FileExplorerList
