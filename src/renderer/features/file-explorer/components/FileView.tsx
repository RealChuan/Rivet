import type React from 'react'
import { Upload } from 'lucide-react'
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FILE_VIEW_MODE, MAX_LIST_ENTRIES, PROTOCOL } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
import { dialogApi } from '../../../api/dialog.js'
import { useUiStore } from '../../../stores/index.js'
import { useConnectionStore } from '../../session/stores/connection.js'
import { useSessionStore } from '../../session/stores/session.js'
import { useFileExplorerTransferActions } from '../contexts/transfer-actions.js'
import {
  useColumnResizing,
  useDirectoryInvalidation,
  useDirectoryList,
  useDirectoryNavigation,
  useElementWidth,
  useFileDragSelect,
  useFileListState,
  useFileSort,
  useSelection,
  useVirtualRows,
} from '../hooks/index.js'
import {
  computeFileViewLayout,
  FILE_GRID_CELL_HEIGHT,
  FILE_LIST_ROW_HEIGHT,
  navigationDelta,
  type ArrowKey,
} from '../virtualization/layout.js'
import FileExplorerDialogs from './FileExplorerDialogs.js'
import FileGrid from './FileGrid.js'
import FileList from './FileList.js'
import FileListHeader from './FileListHeader.js'
import {
  FileExplorerListEmpty,
  FileExplorerListError,
  FileExplorerListLoading,
} from './FileListStates.js'
import ParentDirectoryButton from './ParentDirectoryButton.js'

interface FileViewProps {
  sessionId: string
  currentPath: string
}

const ARROW_KEYS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

function isArrowKey(key: string): key is ArrowKey {
  return ARROW_KEYS.includes(key)
}

export const FileView = ({ sessionId, currentPath }: FileViewProps) => {
  const { t } = useTranslation()
  const sessions = useSessionStore((state) => state.sessions)
  const updateCurrentPath = useSessionStore((state) => state.updateCurrentPath)
  const connections = useConnectionStore((state) => state.connections)
  const session = sessions.find((s) => s.sessionId === sessionId)
  const mode = useUiStore((state) => state.fileViewModes[sessionId] ?? FILE_VIEW_MODE.LIST)
  const connection = connections.find((c) => c.id === session?.connectionId)
  const isSftp = connection?.protocol === PROTOCOL.SFTP
  const { startMixedUpload } = useFileExplorerTransferActions()
  const [isDragOver, setIsDragOver] = useState(false)

  const { files, isLoading, isFetching, error, refetch } = useDirectoryList(sessionId, currentPath)
  const { markSessionStale } = useDirectoryInvalidation()
  const listState = useFileListState()
  const { sortBy, sortOrder, sortedFiles, handleSort } = useFileSort(files)
  const selection = useSelection(sortedFiles)
  const clearSelection = selection.clear

  const { actualColumnWidths, handleResizeStart, containerRef, resetColumnWidths } =
    useColumnResizing({ isSftp })
  const { handleDoubleClick, handleParentDirectory } = useDirectoryNavigation(
    sessionId,
    currentPath,
    updateCurrentPath,
    () => markSessionStale(sessionId),
    selection.clear,
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const containerWidth = useElementWidth(scrollRef)
  const layout = computeFileViewLayout({
    entryCount: sortedFiles.length,
    mode,
    containerWidth,
  })
  const virtualRows = useVirtualRows({
    rowCount: layout.rowCount,
    rowHeight: layout.rowHeight,
    scrollRef,
  })

  const { isDragging, hasStartedDrag, handleMouseDown, getDragStyle } = useFileDragSelect({
    entries: sortedFiles,
    columns: layout.columns,
    cellWidth: layout.columns > 0 ? containerWidth / layout.columns : containerWidth,
    rowHeight: layout.rowHeight,
    scrollContainerRef: scrollRef,
    onDragStart: selection.clear,
    onDragSelect: (paths) => selection.replace(paths),
  })

  useEffect(() => {
    if (!isLoading) resetColumnWidths()
  }, [isLoading, resetColumnWidths])

  // 切 host / 切目录时清掉上一台机器的选择与滚动位置，避免复用残留状态。
  useEffect(() => {
    clearSelection()
    if (typeof scrollRef.current?.scrollTo === 'function') {
      scrollRef.current.scrollTo({ top: 0 })
    }
  }, [sessionId, currentPath, clearSelection])

  useEffect(() => {
    const focusedPath = selection.focusedPath
    if (!focusedPath) return
    const nodes = scrollRef.current?.querySelectorAll<HTMLElement>('[data-file-path]')
    const target = Array.from(nodes ?? []).find((node) => node.dataset.filePath === focusedPath)
    target?.focus({ preventScroll: true })
    target?.scrollIntoView?.({ block: 'nearest' })
  }, [selection.focusedPath])

  const handleContextMenu = (file?: FileInfo) => {
    if (file) {
      if (!selection.isSelected(file.absolutePath)) {
        selection.select(file.absolutePath, { ctrl: false, shift: false })
      }
      listState.openContextMenu(
        selection.isSelected(file.absolutePath) ? selection.selectedEntries : [file],
        false,
      )
    } else {
      selection.clear()
      listState.openContextMenu([], true)
    }
  }

  const handleActivate = (file: FileInfo) => {
    handleDoubleClick(file)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      selection.selectAll()
      return
    }

    if (isArrowKey(e.key)) {
      e.preventDefault()
      selection.moveFocus(navigationDelta(e.key, { mode, columns: layout.columns }))
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

      const filePath = dialogApi.getPathForFile(file)
      if (!filePath) continue

      if (entry?.isDirectory) {
        folderPaths.push(filePath)
      } else {
        filePaths.push(filePath)
      }
    }

    if (filePaths.length === 0 && folderPaths.length === 0) return
    void startMixedUpload(filePaths, folderPaths, sessionId, currentPath)
  }

  if (!session) return null

  if (isLoading && files.length === 0) {
    return <FileExplorerListLoading />
  }

  if (error && files.length === 0) {
    return <FileExplorerListError error={error.message} onRetry={() => void refetch()} />
  }

  const truncated = sortedFiles.length >= MAX_LIST_ENTRIES

  return (
    <ContextMenuPrimitive.Root
      onOpenChange={(open) => {
        if (!open) listState.closeContextMenu()
      }}
    >
      <div
        className="flex flex-col h-full"
        style={{ width: '100%' }}
        data-testid="file-view"
        data-view-mode={mode}
      >
        {(isFetching || session.isOperating) && files.length > 0 && (
          <div className="h-0.5 bg-accent/10 shrink-0 overflow-hidden">
            <div className="h-full bg-accent animate-progress-indeterminate" />
          </div>
        )}
        {truncated && (
          <div className="px-4 py-1.5 text-xs text-text-muted border-b border-border shrink-0">
            {t(($) => $.fileExplorerList.truncated)}
          </div>
        )}
        <ContextMenuPrimitive.Trigger asChild>
          <div
            ref={containerRef}
            className="flex-1 min-h-10 relative overflow-hidden"
            onContextMenu={(e) => {
              const target = e.target as HTMLElement
              if (!target.closest('[data-file-item]')) {
                handleContextMenu()
              }
            }}
            onMouseDown={handleMouseDown}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onKeyDown={handleKeyDown}
          >
            {isDragOver && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-accent/5 border-2 border-dashed border-accent rounded pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-accent">
                  <Upload className="w-8 h-8 stroke-current stroke-2" />
                  <span className="text-sm font-medium">{t(($) => $.file.dropToUpload)}</span>
                </div>
              </div>
            )}
            <div className="flex flex-col h-full">
              {mode === FILE_VIEW_MODE.LIST && (
                <FileListHeader
                  columnWidths={actualColumnWidths}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  onResizeStart={handleResizeStart}
                  isSftp={isSftp}
                />
              )}

              {sortedFiles.length === 0 ? (
                <FileExplorerListEmpty />
              ) : (
                <div className="flex-1 min-h-0 relative">
                  {mode === FILE_VIEW_MODE.GRID ? (
                    <FileGrid
                      entries={sortedFiles}
                      virtualRows={virtualRows}
                      totalSize={layout.totalSize}
                      columns={layout.columns}
                      rowHeight={FILE_GRID_CELL_HEIGHT}
                      selection={selection}
                      scrollRef={scrollRef}
                      containerWidth={containerWidth}
                      onActivate={handleActivate}
                      onContextMenu={handleContextMenu}
                      onMouseDown={handleMouseDown}
                    />
                  ) : (
                    <FileList
                      entries={sortedFiles}
                      virtualRows={virtualRows}
                      totalSize={layout.totalSize}
                      rowHeight={FILE_LIST_ROW_HEIGHT}
                      columnWidths={actualColumnWidths}
                      isSftp={isSftp}
                      selection={selection}
                      scrollRef={scrollRef}
                      onActivate={handleActivate}
                      onContextMenu={handleContextMenu}
                      onHover={(name) => listState.setHoveredFile(name)}
                      onMouseDown={handleMouseDown}
                    />
                  )}
                  {isDragging && hasStartedDrag && (
                    <div
                      className="absolute pointer-events-none z-100 rounded-sm border-[1.5px] border-accent bg-accent-light"
                      style={getDragStyle()}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </ContextMenuPrimitive.Trigger>

        <ParentDirectoryButton currentPath={currentPath} onNavigate={handleParentDirectory} />

        <FileExplorerDialogs
          sessionId={sessionId}
          currentPath={currentPath}
          listState={listState}
          isSftp={isSftp}
          onClearSelection={selection.clear}
        />
      </div>
    </ContextMenuPrimitive.Root>
  )
}

export default FileView
