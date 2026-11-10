import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORE_KEY } from '@shared/constants/index.js'
import { useFavoritesStore } from './favorites.js'

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
  useFavoritesStore.setState({ favorites: {} })
})

describe('favorites store', () => {
  it('加载时丢弃形态不对的条目', async () => {
    mockConfigGet.mockResolvedValue({
      success: true,
      value: { c1: ['/a', 3, '/b'], c2: 'not-an-array', c3: [] },
    })

    await useFavoritesStore.getState().load()

    expect(useFavoritesStore.getState().favorites).toEqual({ c1: ['/a', '/b'] })
  })

  it('toggle 添加后立即持久化', () => {
    useFavoritesStore.getState().toggle('c1', '/a')

    expect(useFavoritesStore.getState().favorites).toEqual({ c1: ['/a'] })
    expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.FAVORITES, { c1: ['/a'] })
  })

  it('toggle 已收藏项时移除，空列表删除连接键', () => {
    useFavoritesStore.setState({ favorites: { c1: ['/a'] } })

    useFavoritesStore.getState().toggle('c1', '/a')

    expect(useFavoritesStore.getState().favorites).toEqual({})
    expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.FAVORITES, {})
  })

  it('remove 只删除指定路径', () => {
    useFavoritesStore.setState({ favorites: { c1: ['/a', '/b'] } })

    useFavoritesStore.getState().remove('c1', '/a')

    expect(useFavoritesStore.getState().favorites).toEqual({ c1: ['/b'] })
  })
})
