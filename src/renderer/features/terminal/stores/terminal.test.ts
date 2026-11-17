import { beforeEach, describe, expect, it, vi } from 'vitest'
import { terminalApi } from '../../../api/index.js'
import { useTerminalStore } from './terminal.js'

vi.mock('../../../api/index.js', () => ({
  terminalApi: { close: vi.fn().mockResolvedValue(undefined) },
}))

describe('terminal store', () => {
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

  it('toggle 切换开合', () => {
    useTerminalStore.getState().toggle()
    expect(useTerminalStore.getState().isOpen).toBe(true)
    useTerminalStore.getState().toggle()
    expect(useTerminalStore.getState().isOpen).toBe(false)
  })

  it('收起时顺带取消最大化，下次打开不会直接铺满', () => {
    useTerminalStore.getState().toggle()
    useTerminalStore.getState().toggleMaximize()
    expect(useTerminalStore.getState().isMaximized).toBe(true)

    useTerminalStore.getState().toggle()
    expect(useTerminalStore.getState().isMaximized).toBe(false)
  })

  it('toggleMaximize 来回切换', () => {
    useTerminalStore.getState().toggleMaximize()
    expect(useTerminalStore.getState().isMaximized).toBe(true)
    useTerminalStore.getState().toggleMaximize()
    expect(useTerminalStore.getState().isMaximized).toBe(false)
  })

  it('setHeight 夹在最小与最大之间', () => {
    useTerminalStore.getState().setHeight(10)
    expect(useTerminalStore.getState().height).toBe(160)
    useTerminalStore.getState().setHeight(9999)
    expect(useTerminalStore.getState().height).toBe(640)
  })

  it('ensureTab 只在会话还没有标签时补一条', () => {
    useTerminalStore.getState().ensureTab('s1', '/home')
    const tabs = useTerminalStore.getState().tabsBySession.s1
    expect(tabs).toHaveLength(1)
    expect(useTerminalStore.getState().activeTabBySession.s1).toBe(tabs?.[0]?.terminalId)

    useTerminalStore.getState().ensureTab('s1', '/var')
    expect(useTerminalStore.getState().tabsBySession.s1).toHaveLength(1)
    expect(useTerminalStore.getState().tabsBySession.s1?.[0]?.cwd).toBe('/home')
  })

  it('addTab 追加标签、序号递增并切过去', () => {
    const first = useTerminalStore.getState().addTab('s1', '/home')
    const second = useTerminalStore.getState().addTab('s1', '/var')

    const state = useTerminalStore.getState()
    expect(first).not.toBe(second)
    expect(state.tabsBySession.s1?.map((tab) => tab.index)).toEqual([1, 2])
    expect(state.activeTabBySession.s1).toBe(second)
    expect(state.isOpen).toBe(true)
  })

  it('removeTab 关掉当前标签后落到左邻', () => {
    const first = useTerminalStore.getState().addTab('s1', '/home')
    const second = useTerminalStore.getState().addTab('s1', '/var')
    const third = useTerminalStore.getState().addTab('s1', '/tmp')
    expect(useTerminalStore.getState().activeTabBySession.s1).toBe(third)

    useTerminalStore.getState().removeTab('s1', third)
    expect(useTerminalStore.getState().activeTabBySession.s1).toBe(second)

    useTerminalStore.getState().removeTab('s1', second)
    expect(useTerminalStore.getState().activeTabBySession.s1).toBe(first)
  })

  it('removeTab 关掉最后一条等于收起抽屉并关终端', () => {
    const terminalId = useTerminalStore.getState().addTab('s1', '/home')
    useTerminalStore.getState().setStatus(terminalId, 'ready')

    useTerminalStore.getState().removeTab('s1', terminalId)

    const state = useTerminalStore.getState()
    expect(state.isOpen).toBe(false)
    expect(state.tabsBySession.s1).toEqual([])
    expect(state.activeTabBySession.s1).toBeUndefined()
    expect(state.statusByTab[terminalId]).toBeUndefined()
    expect(terminalApi.close).toHaveBeenCalledWith(terminalId)
  })

  it('removeTab 不动同会话其他标签的终端', () => {
    const first = useTerminalStore.getState().addTab('s1', '/home')
    const second = useTerminalStore.getState().addTab('s1', '/var')

    useTerminalStore.getState().removeTab('s1', first)

    expect(useTerminalStore.getState().tabsBySession.s1?.map((tab) => tab.terminalId)).toEqual([
      second,
    ])
    expect(terminalApi.close).toHaveBeenCalledTimes(1)
    expect(terminalApi.close).toHaveBeenCalledWith(first)
  })

  it('setStatus 只记在还活着的标签上', () => {
    const terminalId = useTerminalStore.getState().addTab('s1', '/home')

    useTerminalStore.getState().setStatus(terminalId, 'error', 'boom')
    expect(useTerminalStore.getState().statusByTab[terminalId]).toBe('error')
    expect(useTerminalStore.getState().errorByTab[terminalId]).toBe('boom')

    useTerminalStore.getState().setStatus('ghost', 'error')
    expect(useTerminalStore.getState().statusByTab.ghost).toBeUndefined()
  })

  it('forget 清掉该会话的标签与状态并关终端', () => {
    const kept = useTerminalStore.getState().addTab('s2', '/srv')
    const dropped = useTerminalStore.getState().addTab('s1', '/home')
    useTerminalStore.getState().setStatus(dropped, 'ready', 'boom')

    useTerminalStore.getState().forget('s1')

    const state = useTerminalStore.getState()
    expect(state.tabsBySession.s1).toBeUndefined()
    expect(state.activeTabBySession.s1).toBeUndefined()
    expect(state.statusByTab[dropped]).toBeUndefined()
    expect(state.errorByTab[dropped]).toBeUndefined()
    expect(state.tabsBySession.s2?.map((tab) => tab.terminalId)).toEqual([kept])
    expect(terminalApi.close).toHaveBeenCalledWith(dropped)
    expect(terminalApi.close).not.toHaveBeenCalledWith(kept)
  })

  it('hasTab 跟着标签增删变化', () => {
    const terminalId = useTerminalStore.getState().addTab('s1', '/home')
    expect(useTerminalStore.getState().hasTab(terminalId)).toBe(true)

    useTerminalStore.getState().forget('s1')
    expect(useTerminalStore.getState().hasTab(terminalId)).toBe(false)
  })
})
