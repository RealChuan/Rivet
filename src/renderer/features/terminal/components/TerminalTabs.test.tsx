import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { terminalApi } from '../../../api/index.js'
import { useTerminalStore } from '../stores/terminal.js'
import { TerminalTabs } from './TerminalTabs.js'

vi.mock('../../../api/index.js', () => ({
  terminalApi: { close: vi.fn().mockResolvedValue(undefined) },
}))

describe('TerminalTabs', () => {
  beforeEach(() => {
    useTerminalStore.setState({
      isOpen: false,
      isMaximized: false,
      height: 240,
      tabsBySession: {},
      activeTabBySession: {},
      statusByTab: {},
      errorByTab: {},
    })
    // afterEach 里的 resetAllMocks 会连实现一起清掉，这里补回来。
    vi.mocked(terminalApi.close).mockResolvedValue(undefined)
  })

  it('没有标签时只留新建按钮', () => {
    render(<TerminalTabs sessionId="s1" cwd="/home" />)

    expect(screen.queryByTestId('terminal-tab-1')).toBeNull()
    expect(screen.getByTestId('terminal-tab-new')).not.toBeNull()
  })

  it('新建标签落在当前目录并自动激活', () => {
    render(<TerminalTabs sessionId="s1" cwd="/home" />)

    fireEvent.click(screen.getByTestId('terminal-tab-new'))

    const state = useTerminalStore.getState()
    expect(state.tabsBySession.s1?.[0]?.cwd).toBe('/home')
    expect(screen.getByTestId('terminal-tab-1').getAttribute('aria-pressed')).toBe('true')
  })

  it('点标签切换到该标签', () => {
    const first = useTerminalStore.getState().addTab('s1', '/home')
    const second = useTerminalStore.getState().addTab('s1', '/var')

    render(<TerminalTabs sessionId="s1" cwd="/home" />)
    expect(useTerminalStore.getState().activeTabBySession.s1).toBe(second)

    fireEvent.click(screen.getByTestId('terminal-tab-1'))

    expect(useTerminalStore.getState().activeTabBySession.s1).toBe(first)
    expect(screen.getByTestId('terminal-tab-1').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('terminal-tab-2').getAttribute('aria-pressed')).toBe('false')
  })

  it('从标签上的关闭按钮收掉该标签', () => {
    useTerminalStore.getState().addTab('s1', '/home')
    useTerminalStore.getState().addTab('s1', '/var')

    render(<TerminalTabs sessionId="s1" cwd="/home" />)
    fireEvent.click(screen.getByTestId('terminal-tab-close-2'))

    expect(useTerminalStore.getState().tabsBySession.s1).toHaveLength(1)
    expect(screen.queryByTestId('terminal-tab-2')).toBeNull()
  })
})
