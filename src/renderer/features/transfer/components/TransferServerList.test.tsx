import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ConnectionConfig, Session } from '@shared/types/index.js'
import { TransferServerList } from './TransferServerList.js'

interface SessionTaskSummary {
  sessionId: string
  running: number
  failed: number
  total: number
}

const mockTransferStore = {
  sessionTaskSummaries: [] as SessionTaskSummary[],
  runningTaskCount: 0,
  selectedSessionId: null as string | null,
  setSelectedSessionId: vi.fn(),
  maxUploadConcurrency: 5,
  maxDownloadConcurrency: 5,
  setMaxUploadConcurrency: vi.fn(),
  setMaxDownloadConcurrency: vi.fn(),
}

const mockSessionStore = {
  sessions: [] as Session[],
}

const mockConnectionStore = {
  connections: [] as ConnectionConfig[],
}

vi.mock('../stores/transfer.js', () => ({
  useTransferStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockTransferStore),
}))

vi.mock('@renderer/features/session/stores/session.js', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockSessionStore),
}))

vi.mock('@renderer/features/session/stores/connection.js', () => ({
  useConnectionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockConnectionStore),
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

const makeConnection = (overrides: Partial<ConnectionConfig> = {}): ConnectionConfig => ({
  id: 'conn-1',
  name: 'Server 1',
  protocol: 'sftp',
  host: 'server1.com',
  port: 22,
  username: 'user1',
  ...overrides,
})

describe('TransferServerList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransferStore.sessionTaskSummaries = []
    mockTransferStore.runningTaskCount = 0
    mockTransferStore.selectedSessionId = null
    mockSessionStore.sessions = []
    mockConnectionStore.connections = []
  })

  it('should show empty state when no sessions', () => {
    render(<TransferServerList />)
    expect(screen.getByText('transfer.empty')).not.toBeNull()
  })

  it('should render server items from sessionTaskSummaries', () => {
    mockTransferStore.sessionTaskSummaries = [
      { sessionId: 'sess-1', running: 1, failed: 0, total: 3 },
    ]
    mockSessionStore.sessions = [makeSession()]
    mockConnectionStore.connections = [makeConnection()]

    render(<TransferServerList />)
    expect(screen.getByText('Server 1')).not.toBeNull()
    expect(screen.getByText(/server1\.com/)).not.toBeNull()
  })

  it('should not cause infinite re-renders with store selectors', () => {
    // Verifies that sessionTaskSummaries, sessions, and connections
    // return stable references from the store. If any were derived
    // via selectors creating new arrays, React would throw
    // "Maximum update depth exceeded".
    mockTransferStore.sessionTaskSummaries = [
      { sessionId: 'sess-1', running: 0, failed: 0, total: 1 },
    ]
    mockSessionStore.sessions = [makeSession()]
    mockConnectionStore.connections = [makeConnection()]

    const { container } = render(<TransferServerList />)
    expect(container.querySelector('[data-testid="transfer-server-list"]')).not.toBeNull()
  })
})
