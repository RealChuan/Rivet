import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME } from '@shared/constants/index.js'
import { TitleBar } from './TitleBar.js'

const chromeState = vi.hoisted(() => ({ value: 'wco' }))
const windowApiMock = vi.hoisted(() => ({
  getState: vi.fn(() => Promise.resolve({ isMaximized: false })),
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
  onStateChanged: vi.fn(() => () => {}),
}))

vi.mock('../../api/env.js', () => ({
  getWindowChrome: () => chromeState.value,
}))

vi.mock('../../api/window.js', () => ({
  windowApi: windowApiMock,
}))

const baseProps = {
  title: 'Rivet',
  theme: THEME.SYSTEM,
  onCycleTheme: vi.fn(),
  language: 'zh-CN' as const,
  onChangeLanguage: vi.fn(),
}

describe('TitleBar', () => {
  beforeEach(() => {
    chromeState.value = 'wco'
    vi.clearAllMocks()
  })

  it('renders a drag header without custom buttons in wco mode', () => {
    render(<TitleBar {...baseProps} />)

    expect(screen.getByTestId('titlebar')).toBeTruthy()
    expect(screen.queryByLabelText(/minimize/i)).toBeNull()
  })

  it('uses an opaque surface instead of a border in wco mode', () => {
    render(<TitleBar {...baseProps} />)

    const classes = screen.getByTestId('titlebar').className.split(' ')
    expect(classes).toContain('bg-titlebar')
    expect(classes).not.toContain('border-b')
  })

  it('renders a full-width 36px drag strip with 80px padding on macOS', () => {
    chromeState.value = 'mac-hidden'
    render(<TitleBar {...baseProps} />)

    const header = screen.getByTestId('titlebar')
    expect(header.style.width).toBe('100%')
    expect(header.style.height).toBe('36px')
    expect(header.style.paddingLeft).toBe('80px')
  })

  it('renders language, theme and window controls in custom mode', () => {
    chromeState.value = 'custom'
    render(<TitleBar {...baseProps} />)

    fireEvent.click(screen.getByLabelText(/minimize/i))
    fireEvent.click(screen.getByLabelText(/maximize/i))
    fireEvent.click(screen.getByLabelText(/close/i))

    expect(windowApiMock.minimize).toHaveBeenCalledOnce()
    expect(windowApiMock.toggleMaximize).toHaveBeenCalledOnce()
    expect(windowApiMock.close).toHaveBeenCalledOnce()
  })
})
