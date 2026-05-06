import { ipcMain } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { defineContract } from '@shared/contract/define.js'
import { registerContract, registerOneWay } from './register.js'

vi.mock('../utils/index.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), catch: vi.fn() },
}))

const contract = defineContract({
  'demo.read': { args: [z.string(), z.number().optional()], result: z.unknown() },
  'demo.ping': { args: [], result: z.unknown() },
})

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>

interface HandleMock {
  mock: { calls: Array<[string, Handler]> }
}

const handleMock = (ipcMain as unknown as { handle: HandleMock }).handle

const emptyHandlers = {
  'demo.read': () => Promise.resolve({ success: true, value: null, error: null }),
  'demo.ping': () => Promise.resolve({ success: true, value: null, error: null }),
}

function getHandler(channel: string): Handler {
  const call = handleMock.mock.calls.find(([name]) => name === channel)
  if (!call) throw new Error(`channel not registered: ${channel}`)
  return call[1]
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('registerContract', () => {
  it('为契约里的每个通道注册 handler', () => {
    registerContract(contract, emptyHandlers)

    expect(handleMock.mock.calls.map(([name]) => name)).toEqual(['demo.read', 'demo.ping'])
  })

  it('参数不合法时返回 INVALID_CONFIG，而不是抛错', async () => {
    registerContract(contract, emptyHandlers)

    const result = await getHandler('demo.read')({}, 42)

    expect(result).toMatchObject({ success: false, error: { code: 'INVALID_CONFIG' } })
  })

  it('handler 同步抛错时返回失败结果，进程不崩', async () => {
    registerContract(contract, {
      'demo.read': () => {
        throw new Error('boom')
      },
      'demo.ping': emptyHandlers['demo.ping'],
    })

    const result = await getHandler('demo.read')({}, 'x')

    expect(result).toMatchObject({
      success: false,
      error: { code: 'INVALID_STATE', message: 'boom' },
    })
  })

  it('handler 异步 reject 时返回失败结果', async () => {
    registerContract(contract, {
      'demo.read': () => Promise.reject(new Error('async boom')),
      'demo.ping': emptyHandlers['demo.ping'],
    })

    const result = await getHandler('demo.read')({}, 'x')

    expect(result).toMatchObject({ success: false, error: { message: 'async boom' } })
  })

  it('registerOneWay 用 ipcMain.on 注册且不返回值', () => {
    const onMock = (ipcMain as unknown as { on: { mock: { calls: Array<[string, Handler]> } } }).on
    const oneWayContract = defineContract({
      'demo.oneway': { args: [z.string()], result: z.void() },
    })
    const handler = vi.fn()

    registerOneWay(oneWayContract, { 'demo.oneway': handler })

    expect(onMock.mock.calls.map(([channel]) => channel)).toEqual(['demo.oneway'])
  })

  it('registerOneWay 参数非法时只记日志，不抛错', () => {
    const onMock = (ipcMain as unknown as { on: { mock: { calls: Array<[string, Handler]> } } }).on
    const oneWayContract = defineContract({
      'demo.oneway': { args: [z.string()], result: z.void() },
    })

    registerOneWay(oneWayContract, { 'demo.oneway': vi.fn() })

    const call = onMock.mock.calls.find(([channel]) => channel === 'demo.oneway')
    if (!call) throw new Error('oneway channel not registered')

    expect(() => call[1]({ sender: {} }, 42)).not.toThrow()
  })

  it('可选参数省略与显式 undefined 等价', async () => {
    const seen: unknown[][] = []
    registerContract(contract, {
      'demo.read': (...args) => {
        seen.push(args)
        return Promise.resolve({ success: true, value: null, error: null })
      },
      'demo.ping': emptyHandlers['demo.ping'],
    })

    const handler = getHandler('demo.read')
    await handler({}, 'x')
    await handler({}, 'x', undefined)

    expect(seen).toEqual([['x'], ['x', undefined]])
  })
})
