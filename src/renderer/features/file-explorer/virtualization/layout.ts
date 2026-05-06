import type { FileViewMode } from '@shared/constants/index.js'

/** 列表行高（px） */
export const FILE_LIST_ROW_HEIGHT = 32
/** 宫格单元宽/高（px，含单元两侧的留白） */
export const FILE_GRID_CELL_WIDTH = 120
export const FILE_GRID_CELL_HEIGHT = 108
/** 宫格横纵间距（px）：左右与上下同值，等于 FileGridItem 两侧 m-1（4px）之和 */
export const FILE_GRID_GAP = 8
/** 上下各多渲染几行，滚动时减少空白 */
export const FILE_VIEW_OVERSCAN = 6

export interface FileViewLayoutInput {
  entryCount: number
  mode: FileViewMode
  containerWidth: number
}

export interface FileViewLayout {
  columns: number
  rowCount: number
  rowHeight: number
  totalSize: number
}

/** 列表恒 1 列；宫格按容器宽度切列。两种布局共用行模型。 */
export function computeFileViewLayout({
  entryCount,
  mode,
  containerWidth,
}: FileViewLayoutInput): FileViewLayout {
  const rowHeight = mode === 'grid' ? FILE_GRID_CELL_HEIGHT : FILE_LIST_ROW_HEIGHT
  const columns =
    mode === 'grid' ? Math.max(1, Math.floor(containerWidth / FILE_GRID_CELL_WIDTH)) : 1
  const rowCount = Math.ceil(entryCount / columns)

  return { columns, rowCount, rowHeight, totalSize: rowCount * rowHeight }
}

export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

/** 键盘导航步进：列表只响应上下键；宫格上下按列步进。 */
export function navigationDelta(
  key: ArrowKey,
  opts: { mode: FileViewMode; columns: number },
): number {
  if (opts.mode === 'list') {
    if (key === 'ArrowUp') return -1
    if (key === 'ArrowDown') return 1
    return 0
  }

  switch (key) {
    case 'ArrowUp':
      return -opts.columns
    case 'ArrowDown':
      return opts.columns
    case 'ArrowLeft':
      return -1
    case 'ArrowRight':
      return 1
  }
}

export interface DragSelectionInput {
  start: { x: number; y: number }
  end: { x: number; y: number }
  rowHeight: number
  cellWidth: number
  columns: number
  entryCount: number
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/**
 * 框选几何：按拖拽矩形与单元格相交计算覆盖的条目索引。
 * 列表是 `columns = 1`、`cellWidth = 容器宽度` 的退化情形。
 */
export function computeDragSelectionIndices({
  start,
  end,
  rowHeight,
  cellWidth,
  columns,
  entryCount,
}: DragSelectionInput): number[] {
  if (entryCount === 0 || rowHeight <= 0 || cellWidth <= 0 || columns <= 0) return []

  const rowCount = Math.ceil(entryCount / columns)
  const left = Math.min(start.x, end.x)
  const right = Math.max(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const bottom = Math.max(start.y, end.y)

  const rowStart = clamp(Math.floor(top / rowHeight), 0, rowCount)
  const rowEnd = clamp(Math.ceil(bottom / rowHeight), 0, rowCount)
  const colStart = clamp(Math.floor(left / cellWidth), 0, columns)
  const colEnd = clamp(Math.ceil(right / cellWidth), 0, columns)

  const indices: number[] = []
  for (let row = rowStart; row < rowEnd; row++) {
    for (let col = colStart; col < colEnd; col++) {
      const index = row * columns + col
      if (index < entryCount) indices.push(index)
    }
  }
  return indices
}
