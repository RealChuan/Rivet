import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Session } from '@shared/types/index.js'
import { FileExplorerContainer } from './FileExplorerContainer.js'

const mockSessionStore = {
  sessions: [] as Session[],
  activeSessionId: null as string | null,
}

vi.mock('@renderer/features/session/stores/session.js', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockSessionStore),
}))

vi.mock('./FileExplorerArea.js', () => ({
  default: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="file-explorer-area" data-session-id={sessionId} />
  ),
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

describe('FileExplorerContainer', () => {
  beforeEach(() => {
    mockSessionStore.sessions = []
    mockSessionStore.activeSessionId = null
  })

  it('should show empty state when no sessions', () => {
    render(<FileExplorerContainer />)
    expect(screen.getByText('connection.noConnections')).not.toBeNull()
  })

  it('should render FileExplorerArea for each session', () => {
    mockSessionStore.sessions = [
      makeSession({ sessionId: 'sess-1' }),
      makeSession({ sessionId: 'sess-2', connectionId: 'conn-2' }),
    ]
    mockSessionStore.activeSessionId = 'sess-1'

    render(<FileExplorerContainer />)
    const areas = screen.getAllByTestId('file-explorer-area')
    expect(areas).toHaveLength(2)
    expect(areas[0]?.dataset.sessionId).toBe('sess-1')
    expect(areas[1]?.dataset.sessionId).toBe('sess-2')
  })

  it('should not cause infinite re-renders with stable sessions reference', () => {
    // Verifies that useSessionStore(state => state.sessions) returns a stable
    // reference. If sessions were derived via a selector that creates a new
    // array each call, React would throw "Maximum update depth exceeded".
    mockSessionStore.sessions = [makeSession()]
    mockSessionStore.activeSessionId = 'sess-1'

    const { container } = render(<FileExplorerContainer />)
    expect(container.querySelector('[data-session-id="sess-1"]')).not.toBeNull()
  })
})
