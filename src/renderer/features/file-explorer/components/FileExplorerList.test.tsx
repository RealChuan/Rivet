import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConnectionConfig, FileInfo, Session } from '@shared/types/index.js'
import { SORT_ORDER } from '@shared/constants/sort.js'
import { TransferActionsContext } from '../contexts/transfer-actions.js'
import { FileExplorerList } from './FileExplorerList.js'

const mockTransferActions = {
  startUpload: vi.fn(),
  startMixedUpload: vi.fn(),
  startDownload: vi.fn(),
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
  initReactI18next: vi.fn(),
}))

vi.mock('react-virtualized-auto-sizer', () => ({
  AutoSizer: ({
    renderProp,
  }: {
    renderProp: (size: { height: number; width: number }) => React.ReactNode
  }) => {
    return renderProp({ height: 400, width: 800 })
  },
}))

vi.mock('react-window', () => ({
  List: ({
    rowHeight,
    rowProps,
    style,
  }: {
    rowHeight: number
    rowProps: {
      items: unknown[]
      renderItem: (item: unknown, index: number, style: React.CSSProperties) => React.ReactNode
      containerWidth: number
    }
    style: React.CSSProperties
  }) => {
    const items = rowProps.items
    const renderItem = rowProps.renderItem
    return (
      <div data-testid="virtual-list" style={style}>
        {items.map((item, index) => {
          const rowStyle = {
            height: rowHeight,
            position: 'absolute' as const,
            top: index * rowHeight,
          }
          return renderItem(item, index, rowStyle)
        })}
      </div>
    )
  },
}))

const mockSessionStore = {
  sessions: [] as Session[],
  updateCurrentPath: vi.fn(),
  refreshCurrentDirectory: vi.fn().mockResolvedValue(undefined),
}

const mockConnectionStore = {
  connections: [] as ConnectionConfig[],
}

vi.mock('@renderer/features/session/stores/session.js', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockSessionStore),
}))

vi.mock('@renderer/features/session/stores/connection.js', () => ({
  useConnectionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockConnectionStore),
}))

vi.mock('@renderer/features/file-explorer/hooks/index.js', () => ({
  useFileDeletion: () => ({ handleDelete: vi.fn() }),
  useFileRenaming: () => ({ handleRename: vi.fn() }),
  useFolderCreation: () => ({ handleCreateFolder: vi.fn() }),
  useFileCopyMove: () => ({
    fileCopyMoveState: { conflicts: [], isProcessing: false },
  }),
  useTransferDialog: () => ({
    openFilePicker: vi.fn(),
    openFolderPicker: vi.fn(),
    openDownloadDialog: vi.fn(),
  }),
  useColumnResizing: () => ({
    columnWidths: { name: 300, permissions: 100, owner: 100, size: 100, modifyTime: 150 },
    actualColumnWidths: { name: 300, permissions: 100, owner: 100, size: 100, modifyTime: 150 },
    handleResizeStart: vi.fn(),
    containerRef: { current: null },
    resetColumnWidths: vi.fn(),
  }),
  useFileDragSelect: () => ({
    dragSelection: new Set<string>(),
    isDragging: false,
    hasStartedDrag: false,
    handleMouseDown: vi.fn(),
    getDragStyle: vi.fn(() => ({})),
  }),
  useFileListState: () => ({
    selectedFile: null,
    selectedFiles: [] as FileInfo[],
    setSelectedFile: vi.fn(),
    setSelectedFiles: vi.fn(),
    deleteDialogOpen: false,
    renameDialogOpen: false,
    fileToDelete: null,
    newFolderDialogOpen: false,
    setNewFolderDialogOpen: vi.fn(),
    hoveredFile: null,
    setHoveredFile: vi.fn(),
    contextMenu: null,
    handleSelectFile: vi.fn(),
    handleMultiSelect: vi.fn(),
    clearSelection: vi.fn(),
    openDeleteDialog: vi.fn(),
    closeDeleteDialog: vi.fn(),
    openRenameDialog: vi.fn(),
    closeRenameDialog: vi.fn(),
    openContextMenu: vi.fn(),
    closeContextMenu: vi.fn(),
  }),
  useFileSort: (files: FileInfo[]) => ({
    sortBy: 'name' as const,
    sortOrder: SORT_ORDER.ASC as typeof SORT_ORDER.ASC,
    sortedFiles: files,
    handleSort: vi.fn(),
  }),
  useDirectoryNavigation: () => ({
    handleDoubleClick: vi.fn(),
    handleParentDirectory: vi.fn(),
  }),
}))

vi.mock('./FileExplorerDialogs.js', () => ({
  default: () => null,
}))

vi.mock('./ParentDirectoryButton.js', () => ({
  default: () => null,
}))

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  sessionId: 'sess-1',
  connectionId: 'conn-1',
  currentPath: '/home',
  files: [],
  isConnected: true,
  isLoading: false,
  isOperating: false,
  error: null,
  ...overrides,
})

const renderWithProvider = (ui: React.ReactElement) =>
  render(<TransferActionsContext value={mockTransferActions}>{ui}</TransferActionsContext>)

describe('FileExplorerList', () => {
  it('should return null when session is not found', () => {
    mockSessionStore.sessions = []
    const { container } = renderWithProvider(
      <FileExplorerList sessionId="nonexistent" currentPath="/home" />
    )
    expect(container.innerHTML).toBe('')
  })

  it('should show loading state', () => {
    mockSessionStore.sessions = [makeSession({ isLoading: true })]
    const { container } = renderWithProvider(
      <FileExplorerList sessionId="sess-1" currentPath="/home" />
    )
    expect(container.querySelectorAll('.animate-skeleton-shimmer').length).toBe(8)
  })

  it('should show error state', () => {
    mockSessionStore.sessions = [makeSession({ error: 'Connection failed', isConnected: false })]
    renderWithProvider(<FileExplorerList sessionId="sess-1" currentPath="/home" />)
    expect(screen.getByText('Connection failed')).not.toBeNull()
  })

  it('should show empty state when no files', () => {
    mockSessionStore.sessions = [makeSession({ files: [] })]
    renderWithProvider(<FileExplorerList sessionId="sess-1" currentPath="/home" />)
    expect(screen.getByText('fileExplorerList.empty')).not.toBeNull()
  })

  it('should render file list header', () => {
    const files: FileInfo[] = [
      {
        name: 'test.txt',
        type: 'file',
        size: 100,
        modifyTime: 1000,
        permissions: 'rw-r--r--',
        owner: 'user',
        absolutePath: '/home/test.txt',
      },
    ]
    mockSessionStore.sessions = [makeSession({ files })]
    renderWithProvider(<FileExplorerList sessionId="sess-1" currentPath="/home" />)
    expect(screen.getByText('fileExplorerList.name')).not.toBeNull()
  })

  it('should not cause infinite re-renders with store selectors', () => {
    const files: FileInfo[] = [
      {
        name: 'stable.txt',
        type: 'file',
        size: 50,
        modifyTime: 2000,
        permissions: 'rw-r--r--',
        owner: 'user',
        absolutePath: '/home/stable.txt',
      },
    ]
    mockSessionStore.sessions = [makeSession({ files })]
    const { container } = renderWithProvider(
      <FileExplorerList sessionId="sess-1" currentPath="/home" />
    )
    expect(container.querySelector('[data-testid="virtual-list"]')).not.toBeNull()
  })
})
