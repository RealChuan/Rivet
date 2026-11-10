import { beforeEach, describe, expect, it } from 'vitest'
import { useNavigationHistoryStore } from './navigation-history.js'

const historyOf = (connectionId: string) =>
  useNavigationHistoryStore.getState().histories[connectionId]

beforeEach(() => {
  useNavigationHistoryStore.setState({ histories: {} })
})

describe('navigationHistory store', () => {
  it('记录访问顺序，重复记录同一路径不入栈', () => {
    const { record } = useNavigationHistoryStore.getState()

    record('c1', '/')
    record('c1', '/a')
    record('c1', '/a')

    expect(historyOf('c1')).toEqual({ paths: ['/', '/a'], index: 1 })
  })

  it('后退/前进按游标移动，越界返回 null', () => {
    const { record, step } = useNavigationHistoryStore.getState()
    record('c1', '/')
    record('c1', '/a')
    record('c1', '/a/b')

    expect(step('c1', -1)).toBe('/a')
    expect(step('c1', -1)).toBe('/')
    expect(step('c1', -1)).toBeNull()

    expect(step('c1', 1)).toBe('/a')
    expect(step('c1', 1)).toBe('/a/b')
    expect(step('c1', 1)).toBeNull()
  })

  it('从历史中间跳新路径时丢弃前进分支', () => {
    const { record, step } = useNavigationHistoryStore.getState()
    record('c1', '/')
    record('c1', '/a')
    record('c1', '/a/b')

    step('c1', -1)
    record('c1', '/a/c')

    expect(historyOf('c1')).toEqual({ paths: ['/', '/a', '/a/c'], index: 2 })
    expect(step('c1', 1)).toBeNull()
  })

  it('不同连接互不影响', () => {
    const { record, step } = useNavigationHistoryStore.getState()
    record('c1', '/one')
    record('c2', '/two')

    step('c1', -1)

    expect(historyOf('c2')).toEqual({ paths: ['/two'], index: 0 })
  })

  it('clear 删除整个连接的历史', () => {
    const { record, clear } = useNavigationHistoryStore.getState()
    record('c1', '/a')
    clear('c1')

    expect(historyOf('c1')).toBeUndefined()
  })
})
