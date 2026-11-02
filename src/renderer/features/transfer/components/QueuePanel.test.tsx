import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionConfig, Session } from '@shared/types/index.js'
import type { TransferTask } from '@shared/types/transfer.js'
import {
  OPERATION_STATUS,
  QUEUE_PANEL_MODE,
  TRANSFER_DIRECTION,
  TRANSFER_SCOPE,
} from '@shared/constants/transfer.js'
import { useUiStore } from '../../../stores/ui.js'
import { useConnectionStore } from '../../session/stores/connection.js'
import { useSessionStore } from '../../session/stores/session.js'
import { useTransferStore } from '../stores/transfer.js'
import { QueuePanel } from './QueuePanel.js'

vi.mock('./VirtualRows.js', () => ({
  VirtualRows: <T,>({
    items,
    renderRow,
  }: {
    items: T[]
    renderRow: (item: T, index: number, style: React.CSSProperties) => React.ReactNode
  }) => <>{items.map((item, index) => renderRow(item, index, {}))}</>,
}))

const session = (overrides: Partial<Session> = {}): Session => ({
  sessionId: 's1',
  connectionId: 'c1',
  currentPath: '/home',
  isConnected: true,
  isOperating: false,
  ...overrides,
})

const connection = (overrides: Partial<ConnectionConfig> = {}): ConnectionConfig => ({
  id: 'c1',
  name: 'Alpha',
  protocol: 'sftp',
  host: 'alpha.test',
  port: 22,
  username: 'user',
  ...overrides,
})

function createTask(overrides: Partial<TransferTask> = {}): TransferTask {
  return {
    id: 'task-1',
    sessionId: 's1',
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

describe('QueuePanel', () => {
  beforeEach(() => {
    useTransferStore.setState({
      tasks: [],
      taskProgress: new Map(),
      activeOperations: new Map(),
      activeTab: TRANSFER_DIRECTION.UPLOAD,
      scope: TRANSFER_SCOPE.CURRENT,
    })
    useUiStore.setState({
      queuePanelMode: QUEUE_PANEL_MODE.EXPANDED,
      queuePanelHeight: 260,
    })
    useSessionStore.setState({
      sessions: [session(), session({ sessionId: 's2', connectionId: 'c2' })],
      activeSessionId: 's1',
    })
    useConnectionStore.setState({
      connections: [connection(), connection({ id: 'c2', name: 'Beta' })],
    })
  })

  it('shows per-direction counts in the header', () => {
    useTransferStore
      .getState()
      .handleTasksEnqueued([
        createTask({ id: 'u1', itemName: 'upload.txt' }),
        createTask({ id: 'u2', itemName: 'upload-2.txt' }),
        createTask({ id: 'd1', direction: TRANSFER_DIRECTION.DOWNLOAD, itemName: 'download.txt' }),
      ])

    render(<QueuePanel />)

    expect(screen.getByRole('button', { name: /transfer\.upload/ }).textContent).toContain('2')
    expect(screen.getByRole('button', { name: /transfer\.download/ }).textContent).toContain('1')
  })

  it('lists only the active direction', () => {
    useTransferStore
      .getState()
      .handleTasksEnqueued([
        createTask({ id: 'u1', itemName: 'upload.txt' }),
        createTask({ id: 'd1', direction: TRANSFER_DIRECTION.DOWNLOAD, itemName: 'download.txt' }),
      ])

    render(<QueuePanel />)

    expect(screen.getByText('upload.txt')).not.toBeNull()
    expect(screen.queryByText('download.txt')).toBeNull()
  })

  it('switches direction when the download tab is clicked', () => {
    useTransferStore
      .getState()
      .handleTasksEnqueued([
        createTask({ id: 'd1', direction: TRANSFER_DIRECTION.DOWNLOAD, itemName: 'download.txt' }),
      ])

    render(<QueuePanel />)
    fireEvent.click(screen.getByRole('button', { name: /transfer\.download/ }))

    expect(screen.getByText('download.txt')).not.toBeNull()
  })

  it('hides the list when collapsed but keeps the header', () => {
    useUiStore.setState({ queuePanelMode: QUEUE_PANEL_MODE.COLLAPSED })
    useTransferStore.getState().handleTasksEnqueued([createTask({ itemName: 'upload.txt' })])

    render(<QueuePanel />)

    expect(screen.getByTestId('queue-panel-header')).not.toBeNull()
    expect(screen.queryByText('upload.txt')).toBeNull()
  })

  it('groups tasks by connection when scope is all', () => {
    useTransferStore.setState({ scope: TRANSFER_SCOPE.ALL })
    useTransferStore
      .getState()
      .handleTasksEnqueued([
        createTask({ id: 'a1', sessionId: 's1', itemName: 'alpha.txt' }),
        createTask({ id: 'b1', sessionId: 's2', itemName: 'beta.txt' }),
      ])

    render(<QueuePanel />)

    expect(screen.getByText('Alpha')).not.toBeNull()
    expect(screen.getByText('Beta')).not.toBeNull()
    expect(screen.getByText('alpha.txt')).not.toBeNull()
    expect(screen.getByText('beta.txt')).not.toBeNull()
  })

  it('points to other connections when the current one has no tasks', () => {
    useTransferStore
      .getState()
      .handleTasksEnqueued([createTask({ id: 'b1', sessionId: 's2', itemName: 'beta.txt' })])

    render(<QueuePanel />)

    expect(screen.getByText('transfer.queue.emptyCurrentScope')).not.toBeNull()

    fireEvent.click(screen.getByText('transfer.queue.viewAll'))

    expect(useTransferStore.getState().scope).toBe(TRANSFER_SCOPE.ALL)
    expect(screen.getByText('beta.txt')).not.toBeNull()
  })

  it('maximizes through the header button', () => {
    useTransferStore.getState().handleTasksEnqueued([createTask()])

    render(<QueuePanel />)
    fireEvent.click(screen.getByLabelText('transfer.queue.maximize'))

    expect(useUiStore.getState().queuePanelMode).toBe(QUEUE_PANEL_MODE.MAXIMIZED)
  })
})
