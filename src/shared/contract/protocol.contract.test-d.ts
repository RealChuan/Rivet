import { describe, expectTypeOf, it } from 'vitest'
import type { ResultOf } from './define.js'
import type { protocolContract } from './protocol.contract.js'

describe('协议响应不再携带 requestId', () => {
  it('protocol.list 的结果键集合恰为 success/value/error', () => {
    type Keys = keyof ResultOf<(typeof protocolContract)['protocol.list']>
    expectTypeOf<Keys>().toEqualTypeOf<'success' | 'value' | 'error'>()
  })
})
