import type React from 'react'
import { Upload } from 'lucide-react'
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  FILE_TYPE,
  FILE_VIEW_MODE,
  type FileViewMode,
  MAX_LIST_ENTRIES,
  PROTOCOL,
} from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
import { dialogApi } from '../../../api/dialog.js'
import { useUiStore } from '../../../stores/index.js'
import { useConnectionStore } from '../../session/stores/connection.js'
import { useSessionStore } from '../../session/stores/session.js'
import { useFileExplorerTransferActions } from '../contexts/transfer-actions.js'
import {
  useColumnResizing,
  useConnectionFavorites,
  useCopyPath,
  useDirectoryInvalidation,
  useDirectoryList,
  useDirectoryNavigation,
  useElementWidth,
  FILE_DRAG_MIME,
  useFileCopyMove,
  useFileDragMove,
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
import FileExplorerStatusBar from './FileExplorerStatusBar.js'
import FileGrid from './FileGrid.js'
import FileList from './FileList.js'
import FileListHeader from './FileListHeader.js'
import {
  FileExplorerListEmpty,
  FileExplorerListError,
  FileExplorerListLoading,
} from './FileListStates.js'

interface FileViewProps {
  sessionId: string
  currentPath: string
  /** 当前目录的名称过滤词；空串表示不过滤 */
  filterQuery?: string | undefined
}

const ARROW_KEYS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

function isArrowKey(key: string): key is ArrowKey {
  return ARROW_KEYS.includes(key)
}

/** 翻页步长：列表按可视行数，宫格再乘列数。容器高度拿不到时退化成一行。 */
function pageStep(
  mode: FileViewMode,
  columns: number,
  rowHeight: number,
  viewportHeight: number,
): number {
  const rows = Math.max(1, Math.floor(viewportHeight / rowHeight))
  return rows * (mode === FILE_VIEW_MODE.GRID ? columns : 1)
}

export const FileView = ({ sessionId, currentPath, filterQuery = '' }: FileViewProps) => {
  const { t } = useTranslation()
  const sessions = useSessionStore((state) => state.sessions)
  const updateCurrentPath = useSessionStore((state) => state.updateCurrentPath)
  const connections = useConnectionStore((state) => state.connections)
  const session = sessions.find((s) => s.sessionId === sessionId)
  const mode = useUiStore((state) => state.fileViewModes[sessionId] ?? FILE_VIEW_MODE.LIST)
  const showHiddenFiles = useUiStore((state) => state.showHiddenFiles)
  const connection = connections.find((c) => c.id === session?.connectionId)
  const isSftp = connection?.protocol === PROTOCOL.SFTP
  const { startMixedUpload } = useFileExplorerTransferActions()
  const [isDragOver, setIsDragOver] = useState(false)

  /** 每个目录各自记住「加载更多」翻了几页，回来时不必从头再列。 */
  const [listPages, setListPages] = useState<Record<string, number>>({})
  const pageKey = `${sessionId}\u0000${currentPath}`
  const listPageCount = listPages[pageKey] ?? 1
  const listLimit = listPageCount * MAX_LIST_ENTRIES

  const { files, isLoading, isFetching, error, refetch } = useDirectoryList(
    sessionId,
    currentPath,
    listLimit,
  )
  const { markSessionStale } = useDirectoryInvalidation()
  const listState = useFileListState()
  // 隐藏文件在排序前就滤掉：条目数、截断提示、框选、状态栏都只认可见项。
  const visibleFiles = useMemo(
    () => (showHiddenFiles ? files : files.filter((file) => !file.isHidden)),
    [files, showHiddenFiles],
  )
  // 过滤插在隐藏文件之后、排序之前：条目数、截断提示、框选都只认可见项。
  const matchedFiles = useMemo(() => {
    const query = filterQuery.trim().toLowerCase()
    if (query === '') return visibleFiles
    return visibleFiles.filter((file) => file.name.toLowerCase().includes(query))
  }, [filterQuery, visibleFiles])
  const { sortBy, sortOrder, sortedFiles, handleSort } = useFileSort(matchedFiles)
  const selection = useSelection(sortedFiles)
  const dragMove = useFileDragMove(sessionId, selection)
  const clearSelection = selection.clear
  const copyMove = useFileCopyMove(sessionId)
  const { copyPaths } = useCopyPath()
  const { favoritePaths } = useConnectionFavorites(sessionId)

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

  const { isDragging, hasStartedDrag, dragSelection, handleMouseDown, getDragStyle } =
    useFileDragSelect({
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

  // 切 host / 切目录 / 改过滤词时清掉选择与滚动位置，避免复用残留状态。
  useEffect(() => {
    clearSelection()
    if (typeof scrollRef.current?.scrollTo === 'function') {
      scrollRef.current.scrollTo({ top: 0 })
    }
  }, [sessionId, currentPath, filterQuery, clearSelection])

  // 进入目录后把焦点交给列表容器，方向键不必先点一次；改过滤词时不抢输入框焦点。
  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true })
  }, [sessionId, currentPath, containerRef])

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

  const focusedEntry = sortedFiles.find((file) => file.absolutePath === selection.focusedPath)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return

    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase()

      // Ctrl+Shift+C 与资源管理器一致：复制选中项路径，没有选中则复制当前目录。
      if (key === 'c' && e.shiftKey) {
        e.preventDefault()
        const paths = selection.selectedEntries.map((entry) => entry.absolutePath)
        void copyPaths(paths.length > 0 ? paths : [currentPath])
        return
      }

      if (key === 'a') {
        e.preventDefault()
        selection.selectAll()
        return
      }

      if (key === 'c') {
        e.preventDefault()
        copyMove.handleCopy(selection.selectedEntries)
        return
      }

      if (key === 'x') {
        e.preventDefault()
        copyMove.handleCut(selection.selectedEntries)
        return
      }

      if (key === 'v') {
        e.preventDefault()
        if (copyMove.canPaste) void copyMove.handlePaste(currentPath)
        return
      }
    }

    if (isArrowKey(e.key)) {
      const delta = navigationDelta(e.key, { mode, columns: layout.columns })
      if (delta === 0) return
      e.preventDefault()
      selection.moveFocus(delta, { extend: e.shiftKey })
      return
    }

    switch (e.key) {
      case 'Enter':
        if (!focusedEntry) return
        e.preventDefault()
        handleActivate(focusedEntry)
        return

      case 'Backspace':
        e.preventDefault()
        handleParentDirectory()
        return

      case 'Home':
        e.preventDefault()
        selection.focusEdge('start', { extend: e.shiftKey })
        return

      case 'End':
        e.preventDefault()
        selection.focusEdge('end', { extend: e.shiftKey })
        return

      case 'PageUp':
      case 'PageDown': {
        e.preventDefault()
        const step = pageStep(
          mode,
          layout.columns,
          layout.rowHeight,
          scrollRef.current?.clientHeight ?? 0,
        )
        selection.moveFocus(e.key === 'PageUp' ? -step : step, { extend: e.shiftKey })
        return
      }

      case 'Delete':
        if (selection.selectedEntries.length === 0) return
        e.preventDefault()
        listState.openDeleteDialog(selection.selectedEntries)
        return

      case 'F2': {
        if (selection.selectedEntries.length !== 1) return
        const target = focusedEntry ?? selection.selectedEntries[0]
        if (!target) return
        e.preventDefault()
        listState.openRenameDialog(target)
        return
      }

      case 'Escape':
        clearSelection()
        return

      default:
        return
    }
  }

  /** 行内拖动只认私有 MIME：`Files` 才是从操作系统拖进来的上传。 */
  const isInternalDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(FILE_DRAG_MIME)

  const handleDragOver = (e: React.DragEvent) => {
    if (isInternalDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (isInternalDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    if (isInternalDrag(e)) return
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

  const truncated = files.length >= listLimit
  const isFiltering = filterQuery.trim() !== ''
  // 框选松手前 selection 还没写回，用实时覆盖数，否则拖动时计数会滞后。
  const selectedCount = hasStartedDrag ? dragSelection.size : selection.selectedPaths.size
  // 文件夹不递归：只报数量，大小只累加文件。
  const selectedSize = selection.selectedEntries.reduce(
    (sum, file) => (file.type === FILE_TYPE.FILE ? sum + (file.size ?? 0) : sum),
    0,
  )
  const selectedFolderCount = selection.selectedEntries.filter(
    (file) => file.type === FILE_TYPE.DIRECTORY,
  ).length

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
          <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-text-muted border-b border-border shrink-0">
            <span>{t(($) => $.fileExplorerList.truncated, { limit: listLimit })}</span>
            <button
              type="button"
              data-testid="file-list-load-more"
              onClick={() => setListPages((prev) => ({ ...prev, [pageKey]: listPageCount + 1 }))}
              className="text-accent hover:underline"
            >
              {t(($) => $.fileExplorerList.loadMore)}
            </button>
          </div>
        )}
        <ContextMenuPrimitive.Trigger asChild>
          <div
            ref={containerRef}
            tabIndex={0}
            className="flex-1 min-h-10 relative overflow-hidden outline-none"
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
                <FileExplorerListEmpty filtered={isFiltering} />
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
                      dragSelection={dragSelection}
                      cutSelection={copyMove.cutPaths}
                      favoritePaths={favoritePaths}
                      dragMove={dragMove}
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
                      dragSelection={dragSelection}
                      cutSelection={copyMove.cutPaths}
                      favoritePaths={favoritePaths}
                      dragMove={dragMove}
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

        <FileExplorerStatusBar
          currentPath={currentPath}
          onNavigate={handleParentDirectory}
          selectedCount={selectedCount}
          selectedSize={selectedSize}
          selectedFolderCount={selectedFolderCount}
          visibleCount={sortedFiles.length}
          listedCount={files.length}
          isFiltering={isFiltering}
        />

        <FileExplorerDialogs
          sessionId={sessionId}
          currentPath={currentPath}
          listState={listState}
          copyMove={copyMove}
          isSftp={isSftp}
          onClearSelection={selection.clear}
        />
      </div>
    </ContextMenuPrimitive.Root>
  )
}

export default FileView
