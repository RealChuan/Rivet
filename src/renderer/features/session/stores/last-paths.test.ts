import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORE_KEY } from '@shared/constants/index.js'
import { useLastPathsStore } from './last-paths.js'

const mockConfigGet = vi.fn()
const mockConfigSet = vi.fn()

vi.stubGlobal('window', {
  electronAPI: {
    config: { get: mockConfigGet, set: mockConfigSet },
  },
})

beforeEach(() => {
  mockConfigGet.mockReset()
  mockConfigSet.mockReset()
  mockConfigSet.mockResolvedValue({ success: true, value: undefined })
  useLastPathsStore.setState({ lastPaths: {} })
})

describe('last-paths store', () => {
  it('加载时丢弃形态不对的条目', async () => {
    mockConfigGet.mockResolvedValue({
      success: true,
      value: { c1: '/home', c2: 3, c3: '' },
    })

    await useLastPathsStore.getState().load()

    expect(useLastPathsStore.getState().lastPaths).toEqual({ c1: '/home' })
  })

  it('读取失败保持空表', async () => {
    mockConfigGet.mockRejectedValue(new Error('boom'))

    await useLastPathsStore.getState().load()

    expect(useLastPathsStore.getState().lastPaths).toEqual({})
  })

  it('remember 写入并立即持久化', () => {
    useLastPathsStore.getState().remember('c1', '/home')

    expect(useLastPathsStore.getState().getPath('c1')).toBe('/home')
    expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.LAST_PATHS, { c1: '/home' })
  })

  it('remember 路径未变时不重复写盘', () => {
    useLastPathsStore.setState({ lastPaths: { c1: '/home' } })

    useLastPathsStore.getState().remember('c1', '/home')

    expect(mockConfigSet).not.toHaveBeenCalled()
  })

  it('forget 删除记录并持久化', () => {
    useLastPathsStore.setState({ lastPaths: { c1: '/home', c2: '/var' } })

    useLastPathsStore.getState().forget('c1')

    expect(useLastPathsStore.getState().lastPaths).toEqual({ c2: '/var' })
    expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.LAST_PATHS, { c2: '/var' })
  })

  it('forget 未记录过的连接时不写盘', () => {
    useLastPathsStore.getState().forget('missing')

    expect(mockConfigSet).not.toHaveBeenCalled()
  })
})
