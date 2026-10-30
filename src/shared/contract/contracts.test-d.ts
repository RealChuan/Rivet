import { describe, expectTypeOf, it } from 'vitest'
import type { invoke as invokeFn, send as sendFn } from '../../preload/invoke.js'
import type { InvokeContract } from './index.js'

declare const invoke: typeof invokeFn
declare const send: typeof sendFn

describe('请求与单向通道互不越界', () => {
  it('invoke 只接受请求通道', () => {
    void invoke('protocol.list', 's1', '/')
    // @ts-expect-error 单向通道不能走 invoke
    void invoke('app.setTheme')
  })

  it('send 只接受单向通道', () => {
    send('app.setTheme', 'dark')
    // @ts-expect-error 请求通道不能走 send
    send('protocol.list', 's1', '/')
  })

  it('请求通道名仍是字面量联合', () => {
    expectTypeOf<'protocol.list'>().toMatchTypeOf<keyof InvokeContract>()
  })
})
