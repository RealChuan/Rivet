import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SharedConstants from '@shared/constants/index.js'
import type { ConnectionConfig, FileInfo, Session } from '@shared/types/index.js'
import type * as FileExplorerHooks from '../hooks/index.js'
import { TransferActionsContext } from '../contexts/transfer-actions.js'
import { FileView } from './FileView.js'

const transferActions = {
  startUpload: vi.fn(),
  startMixedUpload: vi.fn(),
  startDownload: vi.fn(),
}

const renderFileView = () =>
  render(
    <TransferActionsContext value={transferActions}>
      <FileView sessionId="s1" currentPath="/" />
    </TransferActionsContext>,
  )

const mockDirectory = {
  files: [] as FileInfo[],
  isLoading: false,
  isFetching: false,
  error: null as Error | null,
  refetch: vi.fn().mockResolvedValue(undefined),
}

const mockUi = {
  fileViewModes: {} as Record<string, 'list' | 'grid'>,
  setFileViewMode: vi.fn(),
}

const mockDragSelection = new Set<string>()

const mockCopyMove = {
  handleCopy: vi.fn(),
  handleCut: vi.fn(),
  handlePaste: vi.fn().mockResolvedValue({ success: true, value: undefined, error: null }),
  canPaste: false,
  cutPaths: new Set<string>(),
  handleCopyTo: vi.fn(),
  handleMoveTo: vi.fn(),
  handleSelectTargetFolder: vi.fn(),
  handleConflictResolution: vi.fn(),
  targetFolderDialogOpen: false,
  conflictDialogOpen: false,
  conflicts: [],
  pendingOperation: null,
  pendingFiles: [],
  pendingTargetDir: null,
  setTargetFolderDialogOpen: vi.fn(),
  setConflictDialogOpen: vi.fn(),
}

const mockSessions: Session[] = [
  {
    sessionId: 's1',
    connectionId: 'c1',
    currentPath: '/',
    isConnected: true,
    isOperating: false,
  },
]

const mockConnections: ConnectionConfig[] = [
  { id: 'c1', name: 'srv', protocol: 'sftp', host: 'h', port: 22, username: 'u' },
]

vi.mock('@shared/constants/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedConstants>()
  return { ...actual, MAX_LIST_ENTRIES: 2 }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | ((ns: unknown) => unknown)) => {
      if (typeof key === 'function') {
        const path: string[] = []
        const proxy = new Proxy(
          {},
          {
            get(_target, prop) {
              if (typeof prop === 'string') path.push(prop)
              return proxy
            },
          },
        )
        key(proxy)
        return path.join('.')
      }
      return key
    },
    i18n: { language: 'en-US' },
  }),
  initReactI18next: vi.fn(),
}))

vi.mock('../../session/stores/session.js', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      sessions: mockSessions,
      updateCurrentPath: vi.fn(),
      setOperating: vi.fn(),
    }),
}))

vi.mock('../../session/stores/connection.js', () => ({
  useConnectionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ connections: mockConnections }),
}))

vi.mock('../../../stores/index.js', () => ({
  useUiStore: (selector: (state: typeof mockUi) => unknown) => selector(mockUi),
}))

vi.mock('../hooks/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof FileExplorerHooks>()
  return {
    ...actual,
    useDirectoryList: () => mockDirectory,
    useDirectoryInvalidation: () => ({
      invalidateSession: vi.fn(),
      markSessionStale: vi.fn(),
      invalidatePath: vi.fn(),
    }),
    useElementWidth: () => 800,
    useColumnResizing: () => ({
      columnWidths: { name: 300, permissions: 100, owner: 100, size: 100, modifyTime: 150 },
      actualColumnWidths: { name: 300, permissions: 100, owner: 100, size: 100, modifyTime: 150 },
      handleResizeStart: vi.fn(),
      containerRef: { current: null },
      resetColumnWidths: vi.fn(),
    }),
    useVirtualRows: ({ rowCount, rowHeight }: { rowCount: number; rowHeight: number }) =>
      Array.from({ length: rowCount }, (_, index) => ({
        index,
        start: index * rowHeight,
        size: rowHeight,
        key: index,
        end: (index + 1) * rowHeight,
        lane: 0,
      })),
    useFileSort: (files: FileInfo[]) => ({
      sortBy: 'name' as const,
      sortOrder: 'asc' as const,
      sortedFiles: files,
      handleSort: vi.fn(),
    }),
    useFileDragSelect: () => ({
      isDragging: false,
      hasStartedDrag: false,
      dragSelection: mockDragSelection,
      handleMouseDown: vi.fn(),
      getDragStyle: () => ({}),
    }),
  }
})

vi.mock('../hooks/use-file-copy-move.js', () => ({
  useFileCopyMove: () => mockCopyMove,
}))

vi.mock('./FileExplorerDialogs.js', () => ({ default: () => null }))
vi.mock('./ParentDirectoryButton.js', () => ({ default: () => null }))

const FILE: FileInfo = {
  name: 'docs',
  type: 'directory',
  size: 0,
  modifyTime: 0,
  absolutePath: '/docs',
}

const cellByName = (name: string): HTMLElement | null =>
  screen.getByText(name).closest('[role="gridcell"]')

beforeEach(() => {
  mockDirectory.files = [FILE]
  mockDirectory.isLoading = false
  mockDirectory.error = null
  mockUi.fileViewModes = {}
  mockDragSelection.clear()
  mockCopyMove.canPaste = false
  mockCopyMove.cutPaths = new Set()
})

describe('FileView', () => {
  it('有数据时按行渲染列表', () => {
    renderFileView()

    expect(screen.getByRole('grid')).not.toBeNull()
    expect(screen.getByText('docs')).not.toBeNull()
  })

  it('首次加载时显示骨架屏', () => {
    mockDirectory.files = []
    mockDirectory.isLoading = true

    const { container } = renderFileView()

    expect(container.querySelectorAll('.animate-skeleton-shimmer').length).toBeGreaterThan(0)
  })

  it('点击条目后 aria-selected 为 true', async () => {
    renderFileView()

    await userEvent.click(screen.getByText('docs'))

    expect(cellByName('docs')?.getAttribute('aria-selected')).toBe('true')
  })

  it('框选进行中列表条目即时高亮', () => {
    mockDirectory.files = [
      { ...FILE, name: 'a.txt', type: 'file', absolutePath: '/a.txt' },
      { ...FILE, name: 'b.txt', type: 'file', absolutePath: '/b.txt' },
    ]
    mockDragSelection.add('/b.txt')

    renderFileView()

    expect(cellByName('a.txt')?.getAttribute('aria-selected')).toBe('false')
    expect(cellByName('b.txt')?.getAttribute('aria-selected')).toBe('true')
  })

  it('框选进行中宫格条目即时高亮', () => {
    mockUi.fileViewModes = { s1: 'grid' }
    mockDirectory.files = [
      { ...FILE, name: 'a.txt', type: 'file', absolutePath: '/a.txt' },
      { ...FILE, name: 'b.txt', type: 'file', absolutePath: '/b.txt' },
    ]
    mockDragSelection.add('/a.txt')

    renderFileView()

    expect(cellByName('a.txt')?.getAttribute('aria-selected')).toBe('true')
    expect(cellByName('b.txt')?.getAttribute('aria-selected')).toBe('false')
  })

  it('切换到宫格后选中项保持', async () => {
    const { rerender } = renderFileView()
    await userEvent.click(screen.getByText('docs'))

    mockUi.fileViewModes = { s1: 'grid' }
    rerender(
      <TransferActionsContext value={transferActions}>
        <FileView sessionId="s1" currentPath="/" />
      </TransferActionsContext>,
    )

    await waitFor(() => expect(cellByName('docs')?.getAttribute('aria-selected')).toBe('true'))
  })

  it('列表视图下键移动选中项', async () => {
    mockDirectory.files = [FILE, { ...FILE, name: 'next', absolutePath: '/next' }]
    renderFileView()

    await userEvent.click(screen.getByText('docs'))
    await userEvent.keyboard('{ArrowDown}')

    expect(cellByName('next')?.getAttribute('aria-selected')).toBe('true')
  })

  it('达到上限时显示截断提示', () => {
    mockDirectory.files = [
      { ...FILE, name: 'f0', absolutePath: '/f0' },
      { ...FILE, name: 'f1', absolutePath: '/f1' },
    ]

    renderFileView()

    expect(screen.getByText('fileExplorerList.truncated')).not.toBeNull()
  })

  it('错误且无数据时显示重试', async () => {
    mockDirectory.files = []
    mockDirectory.error = new Error('boom')

    renderFileView()

    await userEvent.click(screen.getByText('fileExplorerList.retry'))
    expect(mockDirectory.refetch).toHaveBeenCalled()
  })

  it('Ctrl+C / Ctrl+X 把选中项写入剪贴板', async () => {
    renderFileView()
    await userEvent.click(screen.getByText('docs'))

    await userEvent.keyboard('{Control>}c{/Control}')
    expect(mockCopyMove.handleCopy).toHaveBeenCalledWith([FILE])

    await userEvent.keyboard('{Control>}x{/Control}')
    expect(mockCopyMove.handleCut).toHaveBeenCalledWith([FILE])
  })

  it('Ctrl+V 在剪贴板可用时粘贴到当前目录', async () => {
    mockCopyMove.canPaste = true
    renderFileView()
    await userEvent.click(screen.getByText('docs'))

    await userEvent.keyboard('{Control>}v{/Control}')

    expect(mockCopyMove.handlePaste).toHaveBeenCalledWith('/')
  })

  it('Ctrl+V 在剪贴板不可用时不触发粘贴', async () => {
    renderFileView()
    await userEvent.click(screen.getByText('docs'))

    await userEvent.keyboard('{Control>}v{/Control}')

    expect(mockCopyMove.handlePaste).not.toHaveBeenCalled()
  })
})
