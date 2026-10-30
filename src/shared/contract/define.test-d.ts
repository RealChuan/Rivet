import { describe, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import { defineContract, type ApiOf } from './define.js'

export const contract = defineContract({
  'demo.read': {
    args: [z.string(), z.number().optional()],
    result: z.object({ ok: z.boolean() }),
  },
  'demo.ping': { args: [], result: z.void() },
})

type Demo = ApiOf<'demo', typeof contract>

describe('契约类型推导', () => {
  it('字面量 channel 名被保留', () => {
    expectTypeOf<keyof typeof contract>().toEqualTypeOf<'demo.read' | 'demo.ping'>()
  })

  it('可选参数在方法签名里可省略', () => {
    expectTypeOf<Demo['read']>().parameters.toEqualTypeOf<[string, number?]>()
  })

  it('返回值被推导为 Promise<schema output>', () => {
    expectTypeOf<Demo['read']>().returns.toEqualTypeOf<Promise<{ ok: boolean }>>()
  })

  it('无参通道的签名是空元组', () => {
    expectTypeOf<Demo['ping']>().parameters.toEqualTypeOf<[]>()
    expectTypeOf<Demo['ping']>().returns.toEqualTypeOf<Promise<void>>()
  })
})
