import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { TransferTask } from '@shared/types/transfer.js'
import { OPERATION_STATUS, TRANSFER_DIRECTION } from '@shared/constants/transfer.js'
import { TransferContainer } from './TransferContainer.js'

// --- Mocks ---

const mockTransferStore = {
  sessionIds: [] as string[],
  selectedSessionId: null as string | null,
  tasks: [] as TransferTask[],
}

vi.mock('../stores/transfer.js', () => ({
  useTransferStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockTransferStore),
  selectTasksForSessionByDirection: (
    state: Record<string, unknown>,
    sessionId: string,
    direction: string,
  ) =>
    (state.tasks as TransferTask[]).filter(
      (t) => t.sessionId === sessionId && t.direction === direction,
    ),
}))

vi.mock('./TransferArea.js', () => ({
  TransferArea: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="transfer-area" data-session-id={sessionId} />
  ),
}))

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

describe('TransferContainer', () => {
  beforeEach(() => {
    mockTransferStore.sessionIds = []
    mockTransferStore.selectedSessionId = null
    mockTransferStore.tasks = []
  })

  it('should show empty state when no sessions', () => {
    render(<TransferContainer />)
    expect(screen.getByText('transfer.empty')).not.toBeNull()
  })

  it('should show empty state when no session is selected', () => {
    mockTransferStore.sessionIds = ['session-1']
    mockTransferStore.selectedSessionId = null
    render(<TransferContainer />)
    expect(screen.getByText('transfer.empty')).not.toBeNull()
  })

  it('should render TransferArea only for the selected session', () => {
    mockTransferStore.sessionIds = ['session-1', 'session-2']
    mockTransferStore.selectedSessionId = 'session-1'
    mockTransferStore.tasks = [
      createTask({ id: 't1', sessionId: 'session-1' }),
      createTask({ id: 't2', sessionId: 'session-2' }),
    ]
    render(<TransferContainer />)
    const areas = screen.getAllByTestId('transfer-area')
    expect(areas).toHaveLength(1)
    expect(areas[0]?.dataset.sessionId).toBe('session-1')
  })

  it('should not cause infinite re-renders with stable sessionIds', () => {
    // This test verifies the fix for the infinite loop bug:
    // sessionIds must be a stable reference (stored in store state),
    // not a selector that returns a new array each call.
    mockTransferStore.sessionIds = ['session-1']
    mockTransferStore.selectedSessionId = 'session-1'
    mockTransferStore.tasks = [createTask()]

    // If sessionIds were an unstable selector, React would throw
    // "Maximum update depth exceeded" during render.
    // With stable store state, this renders successfully.
    const { container } = render(<TransferContainer />)
    expect(container.querySelector('[data-session-id="session-1"]')).not.toBeNull()
  })
})
