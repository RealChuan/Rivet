import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_NAME_WIDTH = 125
const DEFAULT_MODIFY_TIME_WIDTH = 150
const DEFAULT_SIZE_WIDTH = 100
const FIXED_COLUMNS_WIDTH = DEFAULT_NAME_WIDTH
const GAP_WIDTH = 6
const MIN_COLUMN_WIDTH = 50
const SCROLLBAR_WIDTH = 17

interface ColumnWidths {
  name: number
  permissions: number
  owner: number
  size: number
  modifyTime: number
}

interface UseColumnResizingOptions {
  isWebdav: boolean
  initialWidths?: Partial<ColumnWidths>
}

interface UseColumnResizingReturn {
  columnWidths: ColumnWidths
  actualColumnWidths: ColumnWidths
  hasUserResized: boolean
  handleResizeStart: (column: string, x: number, width: number) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  resetColumnWidths: () => void
}

const DEFAULT_WIDTHS: ColumnWidths = {
  name: DEFAULT_SIZE_WIDTH,
  permissions: DEFAULT_NAME_WIDTH,
  owner: DEFAULT_NAME_WIDTH,
  size: DEFAULT_NAME_WIDTH,
  modifyTime: DEFAULT_MODIFY_TIME_WIDTH,
}

function computeColumnWidths(
  containerWidth: number,
  scrollbarWidth: number,
  isWebdav: boolean
): ColumnWidths {
  const { numFixedColumns, numGaps, permissionsWidth, ownerWidth } = isWebdav
    ? { numFixedColumns: 1, numGaps: 3, permissionsWidth: 0, ownerWidth: 0 }
    : {
        numFixedColumns: 3,
        numGaps: 5,
        permissionsWidth: FIXED_COLUMNS_WIDTH,
        ownerWidth: FIXED_COLUMNS_WIDTH,
      }

  const totalFixedWidth =
    FIXED_COLUMNS_WIDTH * numFixedColumns + DEFAULT_MODIFY_TIME_WIDTH + GAP_WIDTH * numGaps
  const nameWidth = Math.max(DEFAULT_SIZE_WIDTH, containerWidth - totalFixedWidth - scrollbarWidth)

  return {
    name: nameWidth,
    permissions: permissionsWidth,
    owner: ownerWidth,
    size: FIXED_COLUMNS_WIDTH,
    modifyTime: DEFAULT_MODIFY_TIME_WIDTH,
  }
}

export function computeTotalWidth(widths: ColumnWidths, isWebdav: boolean): number {
  const numGaps = isWebdav ? 3 : 5
  return (
    widths.name +
    widths.permissions +
    widths.owner +
    widths.size +
    widths.modifyTime +
    GAP_WIDTH * numGaps
  )
}

export function useColumnResizing(options: UseColumnResizingOptions): UseColumnResizingReturn {
  const { isWebdav, initialWidths } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    ...DEFAULT_WIDTHS,
    ...initialWidths,
  })
  const [hasUserResized, setHasUserResized] = useState(false)
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined)

  const handleResizeStart = (column: string, x: number, width: number) => {
    setHasUserResized(true)
    setResizingColumn(column)
    setResizeStartX(x)
    setResizeStartWidth(width)
  }

  useEffect(() => {
    if (!resizingColumn) return

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartX
      const newWidth = resizeStartWidth + deltaX
      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: Math.max(MIN_COLUMN_WIDTH, newWidth),
      }))
    }
    const onMouseUp = () => {
      setResizingColumn(null)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [resizingColumn, resizeStartX, resizeStartWidth])

  const actualColumnWidths = (() => {
    if (!containerWidth || hasUserResized) {
      return columnWidths
    }

    const gapWidth = GAP_WIDTH
    const numGaps = isWebdav ? 3 : 5
    const otherColumnsWidth =
      columnWidths.name +
      columnWidths.permissions +
      columnWidths.owner +
      columnWidths.size +
      gapWidth * numGaps
    const actualModifyTimeWidth = Math.max(
      columnWidths.modifyTime,
      containerWidth - otherColumnsWidth
    )

    return {
      ...columnWidths,
      modifyTime: actualModifyTimeWidth,
    }
  })()

  useEffect(() => {
    if (!containerRef.current) return

    const doCalculate = (width?: number) => {
      const container = containerRef.current
      const containerWidth = width ?? container?.offsetWidth
      if (!containerWidth || !container) return

      const currentScrollbarWidth = container.offsetWidth - container.clientWidth
      const scrollbarWidth = Math.max(currentScrollbarWidth, SCROLLBAR_WIDTH)
      setColumnWidths(computeColumnWidths(containerWidth, scrollbarWidth, isWebdav))
    }

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const entryWidth = (entry.target as HTMLElement).offsetWidth
        setContainerWidth(entryWidth)
        if (!hasUserResized) {
          doCalculate(entryWidth)
        }
      }
    })

    resizeObserver.observe(containerRef.current)

    requestAnimationFrame(() => {
      const width = containerRef.current?.offsetWidth
      setContainerWidth(width)
      doCalculate(width)
    })

    return () => resizeObserver.disconnect()
  }, [hasUserResized, isWebdav])

  const resetColumnWidths = useCallback(() => {
    setHasUserResized(false)
    const container = containerRef.current
    const width = container?.offsetWidth
    if (!width || !container) return

    const currentScrollbarWidth = container.offsetWidth - container.clientWidth
    const scrollbarWidth = Math.max(currentScrollbarWidth, 17)
    setColumnWidths(computeColumnWidths(width, scrollbarWidth, isWebdav))
  }, [isWebdav])

  return {
    columnWidths,
    actualColumnWidths,
    hasUserResized,
    handleResizeStart,
    containerRef,
    resetColumnWidths,
  }
}
