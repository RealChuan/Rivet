import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConnectionConfig, Session } from '@shared/types/index.js'
import { ConnectionItem } from './ConnectionItem.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}))

const mockConnection: ConnectionConfig = {
  id: 'conn-1',
  name: 'Test Server',
  protocol: 'sftp',
  host: 'example.com',
  port: 22,
  username: 'user',
}

const mockConnectedSession: Session = {
  sessionId: 'sess-1',
  connectionId: 'conn-1',
  currentPath: '/home',
  files: [],
  isConnected: true,
  isLoading: false,
  isOperating: false,
  error: null,
}

const defaultProps = {
  connection: mockConnection,
  session: undefined,
  isActive: false,
  onSelect: vi.fn(),
  onDisconnect: vi.fn(),
  onReconnect: vi.fn(),
  onDelete: vi.fn(),
  onEdit: vi.fn(),
}

describe('ConnectionItem', () => {
  it('should display connection name', () => {
    render(<ConnectionItem {...defaultProps} />)
    expect(screen.getByText('Test Server')).not.toBeNull()
  })

  it('should display host when name is empty', () => {
    const connection = { ...mockConnection, name: '' }
    render(<ConnectionItem {...defaultProps} connection={connection} />)
    const nameElements = screen.getAllByText('example.com')
    expect(nameElements.length).toBeGreaterThan(0)
  })

  it('should display host address', () => {
    render(<ConnectionItem {...defaultProps} />)
    expect(screen.getByText('example.com')).not.toBeNull()
  })

  it('should display protocol badge', () => {
    render(<ConnectionItem {...defaultProps} />)
    expect(screen.getByText('SFTP')).not.toBeNull()
  })

  it('should show connected status indicator when connected', () => {
    render(<ConnectionItem {...defaultProps} session={mockConnectedSession} />)
    const nameElement = screen.getByText('Test Server')
    const container = nameElement.closest('div[class*="mx-2"]')
    if (!container) throw new Error('Container not found')
    expect(container.innerHTML).toContain('text-status-connected')
  })

  it('should show disconnected status indicator when not connected', () => {
    render(<ConnectionItem {...defaultProps} />)
    const nameElement = screen.getByText('Test Server')
    const container = nameElement.closest('div[class*="mx-2"]')
    if (!container) throw new Error('Container not found')
    expect(container.innerHTML).toContain('text-status-disconnected')
  })

  it('should call onSelect when item is clicked', () => {
    const onSelect = vi.fn()
    render(<ConnectionItem {...defaultProps} onSelect={onSelect} />)
    const nameElement = screen.getByText('Test Server')
    const clickableDiv = nameElement.closest('div[class*="cursor-pointer"]')
    if (!clickableDiv) throw new Error('Clickable div not found')
    fireEvent.click(clickableDiv)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('should show menu button', () => {
    render(<ConnectionItem {...defaultProps} />)
    const menuButtons = screen.getAllByRole('button')
    expect(menuButtons.length).toBeGreaterThan(0)
  })

  it('should apply active state styling', () => {
    render(<ConnectionItem {...defaultProps} isActive={true} />)
    const nameElement = screen.getByText('Test Server')
    const outerDiv = nameElement.closest('div[class*="rounded-md"]')
    if (!outerDiv) throw new Error('Outer div not found')
    expect(outerDiv.className).toContain('bg-selected')
  })

  it('should show WebDAV protocol badge for webdav connection', () => {
    const webdavConnection = { ...mockConnection, protocol: 'webdav' as const }
    render(<ConnectionItem {...defaultProps} connection={webdavConnection} />)
    expect(screen.getByText('WEBDAV')).not.toBeNull()
  })

  it('should show loading spinner when session is loading', () => {
    const loadingSession: Session = {
      ...mockConnectedSession,
      isLoading: true,
    }
    render(<ConnectionItem {...defaultProps} session={loadingSession} />)
    const nameElement = screen.getByText('Test Server')
    const container = nameElement.closest('div[class*="mx-2"]')
    if (!container) throw new Error('Container not found')
    expect(container.innerHTML).toContain('animate-spin')
  })

  it('should call onDisconnect callback', () => {
    const onDisconnect = vi.fn()
    render(
      <ConnectionItem
        {...defaultProps}
        session={mockConnectedSession}
        onDisconnect={onDisconnect}
      />
    )
    expect(onDisconnect).not.toHaveBeenCalled()
  })

  it('should call onReconnect callback', () => {
    const onReconnect = vi.fn()
    render(<ConnectionItem {...defaultProps} onReconnect={onReconnect} />)
    expect(onReconnect).not.toHaveBeenCalled()
  })
})
