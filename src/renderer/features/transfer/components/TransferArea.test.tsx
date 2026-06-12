import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { TransferTask } from '@shared/types/transfer.js'
import { OPERATION_STATUS, TRANSFER_DIRECTION } from '@shared/constants/transfer.js'
import { useTransferStore } from '../stores/transfer.js'
import { TransferArea } from './TransferArea.js'

// --- Mocks ---

vi.mock('react-virtualized-auto-sizer', () => ({
  AutoSizer: ({
    renderProp,
  }: {
    renderProp: (size: { height: number; width: number }) => React.ReactNode
  }) => {
    return renderProp({ height: 400, width: 800 })
  },
}))

const mockElectronAPI = {
  transfer: {
    cancelAll: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn(),
    cancel: vi.fn(),
    onTasksEnqueued: vi.fn(() => vi.fn()),
    onProgress: vi.fn(() => vi.fn()),
    onTaskCompleted: vi.fn(() => vi.fn()),
    onTaskFailed: vi.fn(() => vi.fn()),
    onTaskRemoved: vi.fn(() => vi.fn()),
  },
  system: {
    generateUuid: vi.fn(() => 'test-uuid'),
  },
  protocol: {
    list: vi.fn(),
    cancel: vi.fn(),
  },
}

vi.stubGlobal('window', {
  electronAPI: mockElectronAPI,
})

function createTask(overrides: Partial<TransferTask> = {}): TransferTask {
  return {
    id: 'task-1',
    sessionId: 'session-1',
    direction: TRANSFER_DIRECTION.UPLOAD,
    localPath: '/local/file.txt',
    remotePath: '/remote/file.txt',
    itemName: 'file.txt',
    itemType: 'file',
    status: OPERATION_STATUS.RUNNING,
    fileSize: 1000,
    transferredSize: 0,
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('TransferArea', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockElectronAPI.transfer.cancelAll.mockResolvedValue(undefined)
    useTransferStore.setState({
      tasks: [],
      taskProgress: new Map(),
      sessionTaskSummaries: [],
      sessionIds: [],
      runningTaskCount: 0,
      selectedSessionId: null,
      activeOperations: new Map(),
      activeTab: TRANSFER_DIRECTION.UPLOAD,
    })
  })

  it('should render upload tab as active by default', () => {
    render(<TransferArea sessionId="session-1" />)
    const uploadTab = screen.getByText('transfer.upload')
    expect(uploadTab).not.toBeNull()
  })

  it('should switch to download tab on click', () => {
    render(<TransferArea sessionId="session-1" />)
    const downloadTab = screen.getByText('transfer.download')
    fireEvent.click(downloadTab)
    expect(downloadTab.className).toContain('text-accent')
  })

  it('should show empty state when no tasks for active tab', () => {
    render(<TransferArea sessionId="session-1" />)
    expect(screen.getByText('transfer.empty')).not.toBeNull()
  })

  it('should only show upload tasks in upload tab', () => {
    useTransferStore.getState().handleTasksEnqueued([
      createTask({ id: 'upload-1', direction: TRANSFER_DIRECTION.UPLOAD, itemName: 'upload.txt' }),
      createTask({
        id: 'download-1',
        direction: TRANSFER_DIRECTION.DOWNLOAD,
        itemName: 'download.txt',
      }),
    ])
    render(<TransferArea sessionId="session-1" />)
    expect(screen.getByText('upload.txt')).not.toBeNull()
    expect(screen.queryByText('download.txt')).toBeNull()
  })

  it('should only show download tasks in download tab', () => {
    useTransferStore.getState().handleTasksEnqueued([
      createTask({ id: 'upload-1', direction: TRANSFER_DIRECTION.UPLOAD, itemName: 'upload.txt' }),
      createTask({
        id: 'download-1',
        direction: TRANSFER_DIRECTION.DOWNLOAD,
        itemName: 'download.txt',
      }),
    ])
    render(<TransferArea sessionId="session-1" />)
    fireEvent.click(screen.getByText('transfer.download'))
    expect(screen.getByText('download.txt')).not.toBeNull()
    expect(screen.queryByText('upload.txt')).toBeNull()
  })

  it('should call cancelAll with sessionId when cancel all is clicked', () => {
    useTransferStore.getState().handleTasksEnqueued([createTask()])
    render(<TransferArea sessionId="session-1" />)
    const cancelButton = screen.getByText('transfer.action.cancelAll')
    fireEvent.click(cancelButton)
    expect(mockElectronAPI.transfer.cancelAll).toHaveBeenCalledWith('session-1')
  })

  it('should not cause infinite re-renders', () => {
    // Uses the real store so useSyncExternalStore is active.
    // If selectTasksForSessionByDirection returns unstable references
    // (new array each call without useShallow), React will throw
    // "Maximum update depth exceeded".
    useTransferStore.getState().handleTasksEnqueued([createTask()])
    const { container } = render(<TransferArea sessionId="session-1" />)
    expect(container).not.toBeNull()
  })
})
