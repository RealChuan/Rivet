import { beforeEach, describe, expect, it } from 'vitest'
import { useTerminalStore } from './terminal.js'

describe('terminal store', () => {
  beforeEach(() => {
    useTerminalStore.setState({
      isOpen: false,
      isMaximized: false,
      height: 240,
      statusBySession: {},
      errorBySession: {},
    })
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

  it('forget 清掉该会话的状态与错误', () => {
    useTerminalStore.getState().setStatus('s1', 'error', 'boom')
    useTerminalStore.getState().forget('s1')

    const state = useTerminalStore.getState()
    expect(state.statusBySession.s1).toBeUndefined()
    expect(state.errorBySession.s1).toBeUndefined()
  })
})
