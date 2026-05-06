import { beforeEach, describe, expect, it } from 'vitest'
import type { Session } from '@shared/types/index.js'
import { useSessionStore } from './session.js'

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  sessionId: 'sess-1',
  connectionId: 'conn-1',
  currentPath: '/home',
  isConnected: true,
  isOperating: false,
  ...overrides,
})

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      activeSessionId: null,
    })
  })

  it('addSession 把新会话设为活跃', () => {
    useSessionStore.getState().addSession(makeSession())

    expect(useSessionStore.getState().sessions).toHaveLength(1)
    expect(useSessionStore.getState().activeSessionId).toBe('sess-1')
  })

  it('replaceSession 按 connectionId 替换并激活', () => {
    useSessionStore.setState({ sessions: [makeSession({ sessionId: 'old' })] })

    useSessionStore.getState().replaceSession('conn-1', makeSession({ sessionId: 'new' }))

    expect(useSessionStore.getState().sessions.map((s) => s.sessionId)).toEqual(['new'])
    expect(useSessionStore.getState().activeSessionId).toBe('new')
  })

  it('removeSession 清理活跃会话', () => {
    useSessionStore.setState({ sessions: [makeSession()], activeSessionId: 'sess-1' })

    useSessionStore.getState().removeSession('sess-1')

    expect(useSessionStore.getState().sessions).toEqual([])
    expect(useSessionStore.getState().activeSessionId).toBeNull()
  })

  it('removeSession 不影响其它会话的活跃标记', () => {
    useSessionStore.setState({
      sessions: [makeSession(), makeSession({ sessionId: 'sess-2' })],
      activeSessionId: 'sess-2',
    })

    useSessionStore.getState().removeSession('sess-1')

    expect(useSessionStore.getState().activeSessionId).toBe('sess-2')
  })

  it('updateCurrentPath 只改目标会话', () => {
    useSessionStore.setState({
      sessions: [makeSession(), makeSession({ sessionId: 'sess-2' })],
    })

    useSessionStore.getState().updateCurrentPath('sess-1', '/var')

    expect(useSessionStore.getState().getSessionById('sess-1')?.currentPath).toBe('/var')
    expect(useSessionStore.getState().getSessionById('sess-2')?.currentPath).toBe('/home')
  })

  it('setOperating 写入 isOperating', () => {
    useSessionStore.setState({ sessions: [makeSession()] })

    useSessionStore.getState().setOperating('sess-1', true)

    expect(useSessionStore.getState().getSessionById('sess-1')?.isOperating).toBe(true)
  })

  it('getSessionByConnectionId 命中对应会话', () => {
    useSessionStore.setState({ sessions: [makeSession()] })

    expect(useSessionStore.getState().getSessionByConnectionId('conn-1')?.sessionId).toBe('sess-1')
    expect(useSessionStore.getState().getSessionByConnectionId('missing')).toBeUndefined()
  })
})
