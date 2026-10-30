import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FileInfo } from '@shared/types/index.js'
import { useSelection } from './use-selection.js'

const entries: FileInfo[] = ['a', 'b', 'c', 'd', 'e'].map((name) => ({
  name,
  type: 'file',
  size: 1,
  modifyTime: 0,
  absolutePath: `/${name}`,
}))

const NONE = { ctrl: false, shift: false }

describe('useSelection', () => {
  it('单击替换选中并设置锚点', () => {
    const { result } = renderHook(() => useSelection(entries))

    act(() => result.current.select('/b', NONE))

    expect([...result.current.selectedPaths]).toEqual(['/b'])
    expect(result.current.anchorPath).toBe('/b')
    expect(result.current.focusedPath).toBe('/b')
  })

  it('Ctrl 点击切换单项且锚点跟随', () => {
    const { result } = renderHook(() => useSelection(entries))

    act(() => result.current.select('/a', NONE))
    act(() => result.current.select('/c', { ctrl: true, shift: false }))
    expect([...result.current.selectedPaths].sort()).toEqual(['/a', '/c'])
    expect(result.current.anchorPath).toBe('/c')

    act(() => result.current.select('/a', { ctrl: true, shift: false }))
    expect([...result.current.selectedPaths]).toEqual(['/c'])
  })

  it('Shift 点击按 entries 顺序选中区间，锚点不变', () => {
    const { result } = renderHook(() => useSelection(entries))

    act(() => result.current.select('/b', NONE))
    act(() => result.current.select('/d', { ctrl: false, shift: true }))

    expect([...result.current.selectedPaths]).toEqual(['/b', '/c', '/d'])
    expect(result.current.anchorPath).toBe('/b')
  })

  it('反向 Shift 选择结果与正向一致', () => {
    const { result } = renderHook(() => useSelection(entries))

    act(() => result.current.select('/d', NONE))
    act(() => result.current.select('/b', { ctrl: false, shift: true }))

    expect([...result.current.selectedPaths]).toEqual(['/b', '/c', '/d'])
  })

  it('replace 替换选中集并把锚点/焦点设到首尾', () => {
    const { result } = renderHook(() => useSelection(entries))

    act(() => result.current.replace(['/b', '/c']))
    expect([...result.current.selectedPaths]).toEqual(['/b', '/c'])
    expect(result.current.anchorPath).toBe('/b')
    expect(result.current.focusedPath).toBe('/c')

    act(() => result.current.replace([]))
    expect(result.current.selectedPaths.size).toBe(0)
    expect(result.current.anchorPath).toBeNull()
  })

  it('selectAll 选中全部，clear 清空锚点与焦点', () => {
    const { result } = renderHook(() => useSelection(entries))

    act(() => result.current.selectAll())
    expect(result.current.selectedEntries).toHaveLength(5)
    expect(result.current.anchorPath).toBe('/a')
    expect(result.current.focusedPath).toBe('/e')

    act(() => result.current.clear())
    expect(result.current.selectedPaths.size).toBe(0)
    expect(result.current.anchorPath).toBeNull()
    expect(result.current.focusedPath).toBeNull()
  })

  it('moveFocus 在两端钳制', () => {
    const { result } = renderHook(() => useSelection(entries))

    act(() => result.current.select('/a', NONE))
    act(() => result.current.moveFocus(-1))
    expect(result.current.focusedPath).toBe('/a')

    act(() => result.current.moveFocus(10))
    expect(result.current.focusedPath).toBe('/e')
  })

  it('selectedEntries 保持 entries 顺序', () => {
    const { result } = renderHook(() => useSelection(entries))

    act(() => result.current.replace(['/d', '/b']))

    expect(result.current.selectedEntries.map((entry) => entry.name)).toEqual(['b', 'd'])
  })
})
