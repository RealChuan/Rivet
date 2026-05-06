import { describe, expect, it } from 'vitest'
import { computeDragSelectionIndices, computeFileViewLayout, navigationDelta } from './layout.js'

describe('computeFileViewLayout', () => {
  it('list 恒为一列，行高 32', () => {
    expect(computeFileViewLayout({ entryCount: 10, mode: 'list', containerWidth: 800 })).toEqual({
      columns: 1,
      rowCount: 10,
      rowHeight: 32,
      totalSize: 320,
    })
  })

  it('grid 按容器宽度算列数并向上取整行数', () => {
    expect(computeFileViewLayout({ entryCount: 10, mode: 'grid', containerWidth: 800 })).toEqual({
      columns: 6,
      rowCount: 2,
      rowHeight: 108,
      totalSize: 216,
    })
  })

  it('容器宽度不足一列时退化为 1 列', () => {
    expect(computeFileViewLayout({ entryCount: 3, mode: 'grid', containerWidth: 0 }).columns).toBe(
      1,
    )
  })

  it('空目录没有行', () => {
    expect(
      computeFileViewLayout({ entryCount: 0, mode: 'grid', containerWidth: 800 }),
    ).toMatchObject({ rowCount: 0, totalSize: 0 })
  })
})

describe('navigationDelta', () => {
  it('list 只响应上下键，grid 上下按列步进、左右按 1 步进', () => {
    expect(navigationDelta('ArrowDown', { mode: 'list', columns: 1 })).toBe(1)
    expect(navigationDelta('ArrowLeft', { mode: 'list', columns: 1 })).toBe(0)
    expect(navigationDelta('ArrowDown', { mode: 'grid', columns: 6 })).toBe(6)
    expect(navigationDelta('ArrowUp', { mode: 'grid', columns: 6 })).toBe(-6)
    expect(navigationDelta('ArrowRight', { mode: 'grid', columns: 6 })).toBe(1)
  })
})

describe('computeDragSelectionIndices', () => {
  it('列表框选按行覆盖，列宽不影响结果', () => {
    expect(
      computeDragSelectionIndices({
        start: { x: 10, y: 10 },
        end: { x: 900, y: 70 },
        rowHeight: 32,
        cellWidth: 800,
        columns: 1,
        entryCount: 10,
      }),
    ).toEqual([0, 1, 2])
  })

  it('宫格框选按矩形与单元格相交计算', () => {
    expect(
      computeDragSelectionIndices({
        start: { x: 140, y: 10 },
        end: { x: 500, y: 150 },
        rowHeight: 112,
        cellWidth: 132,
        columns: 6,
        entryCount: 20,
      }),
    ).toEqual([1, 2, 3, 7, 8, 9])
  })

  it('反向拖拽与越界被钳制', () => {
    expect(
      computeDragSelectionIndices({
        start: { x: 900, y: 900 },
        end: { x: -50, y: -50 },
        rowHeight: 112,
        cellWidth: 132,
        columns: 6,
        entryCount: 5,
      }),
    ).toEqual([0, 1, 2, 3, 4])
  })

  it('框选结果不超过 entryCount 且不重复', () => {
    const indices = computeDragSelectionIndices({
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 10_000 },
      rowHeight: 112,
      cellWidth: 132,
      columns: 6,
      entryCount: 8,
    })
    expect(indices.at(-1)).toBe(7)
    expect(new Set(indices).size).toBe(indices.length)
  })

  it('空目录返回空数组', () => {
    expect(
      computeDragSelectionIndices({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        rowHeight: 112,
        cellWidth: 132,
        columns: 6,
        entryCount: 0,
      }),
    ).toEqual([])
  })
})
