import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnectionList } from './ConnectionList.js'
import type { ConnectionConfig, Session } from '@shared/types/index.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  useDndContext: () => ({ active: null }),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  verticalListSortingStrategy: {},
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: '',
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => ''),
    },
  },
}))

const mockConnection1: ConnectionConfig = {
  id: 'conn-1',
  name: 'Server 1',
  protocol: 'sftp',
  host: 'server1.com',
  port: 22,
  username: 'user1',
}

const mockConnection2: ConnectionConfig = {
  id: 'conn-2',
  name: 'Server 2',
  protocol: 'webdav',
  host: 'server2.com',
  port: 443,
  username: 'user2',
}

const defaultProps = {
  connections: [] as ConnectionConfig[],
  activeSessionId: undefined as string | undefined,
  sortOrder: 'none' as const,
  onSortClick: vi.fn(),
  onReorderConnections: vi.fn(),
  onSelectSession: vi.fn(),
  onDisconnect: vi.fn(),
  onReconnect: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  getSessionByConnectionId: vi.fn(() => undefined),
}

describe('ConnectionList', () => {
  it('should show empty state when no connections', () => {
    render(<ConnectionList {...defaultProps} connections={[]} />)
    expect(screen.getByText('connection.noConnections')).not.toBeNull()
    expect(screen.getByText('connection.newConnectionHint')).not.toBeNull()
  })

  it('should render connection list with connections', () => {
    render(<ConnectionList {...defaultProps} connections={[mockConnection1, mockConnection2]} />)
    expect(screen.getByText('Server 1')).not.toBeNull()
    expect(screen.getByText('Server 2')).not.toBeNull()
  })

  it('should render connections header', () => {
    render(<ConnectionList {...defaultProps} connections={[mockConnection1]} />)
    expect(screen.getByText('connection.connections')).not.toBeNull()
  })

  it('should render sort button', () => {
    render(<ConnectionList {...defaultProps} connections={[mockConnection1]} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('should show host for each connection', () => {
    render(<ConnectionList {...defaultProps} connections={[mockConnection1]} />)
    expect(screen.getByText('server1.com')).not.toBeNull()
  })

  it('should call getSessionByConnectionId for each connection', () => {
    const getSessionByConnectionId = vi.fn(() => undefined)
    render(
      <ConnectionList
        {...defaultProps}
        connections={[mockConnection1, mockConnection2]}
        getSessionByConnectionId={getSessionByConnectionId}
      />
    )
    expect(getSessionByConnectionId).toHaveBeenCalledWith('conn-1')
    expect(getSessionByConnectionId).toHaveBeenCalledWith('conn-2')
  })

  it('should highlight active session', () => {
    const mockSession: Session = {
      sessionId: 'sess-1',
      connectionId: 'conn-1',
      currentPath: '/home',
      files: [],
      isConnected: true,
      isLoading: false,
      error: null,
    }
    render(
      <ConnectionList
        {...defaultProps}
        connections={[mockConnection1]}
        activeSessionId="sess-1"
        getSessionByConnectionId={() => mockSession}
      />
    )
    const nameElement = screen.getByText('Server 1')
    const parent = nameElement.closest('div')
    if (!parent) throw new Error('Parent not found')
    expect(parent.className).toContain('text-accent')
  })
})
