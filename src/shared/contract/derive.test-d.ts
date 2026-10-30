import { describe, expectTypeOf, it } from 'vitest'
import type { EventApi, SendApiOf } from './define.js'
import type { Events } from './events.contract.js'
import type { ElectronAPI, OneWayContract } from './index.js'

describe('API 从契约派生', () => {
  it('app 单向方法来自 OneWayContract', () => {
    expectTypeOf<SendApiOf<'app', OneWayContract>['setTheme']>().toEqualTypeOf<
      (theme: 'light' | 'dark' | 'system') => void
    >()
  })

  it('事件订阅方法名由 on + 方法名派生', () => {
    type ProtocolEvents = EventApi<'protocol', Events>
    expectTypeOf<ProtocolEvents['onSessionDisconnected']>().toBeFunction()
  })

  it('app.closeRequested 派生 onCloseRequested', () => {
    type AppEvents = EventApi<'app', Events>
    expectTypeOf<AppEvents['onCloseRequested']>().toBeFunction()
  })

  it('ElectronAPI 不再手写事件方法', () => {
    expectTypeOf<ElectronAPI['app']['setTheme']>().toBeFunction()
    expectTypeOf<ElectronAPI['protocol']['onSessionDisconnected']>().toBeFunction()
    expectTypeOf<ElectronAPI['app']['onCloseRequested']>().toBeFunction()
  })
})
