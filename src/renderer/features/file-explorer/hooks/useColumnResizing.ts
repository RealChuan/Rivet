import { useState, useRef, useEffect, useCallback } from 'react'

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

export interface UseColumnResizingReturn {
  columnWidths: ColumnWidths
  actualColumnWidths: ColumnWidths
  hasUserResized: boolean
  handleResizeStart: (column: string, x: number, width: number) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  resetColumnWidths: () => void
}

const DEFAULT_WIDTHS: ColumnWidths = {
  name: 100,
  permissions: 125,
  owner: 125,
  size: 125,
  modifyTime: 150,
}

function computeColumnWidths(
  containerWidth: number,
  scrollbarWidth: number,
  isWebdav: boolean
): ColumnWidths {
  const fixedColumnsWidth = 125
  const modifyTimeWidth = 150
  const gapWidth = 6

  const { numFixedColumns, numGaps, permissionsWidth, ownerWidth } = isWebdav
    ? { numFixedColumns: 1, numGaps: 3, permissionsWidth: 0, ownerWidth: 0 }
    : {
        numFixedColumns: 3,
        numGaps: 5,
        permissionsWidth: fixedColumnsWidth,
        ownerWidth: fixedColumnsWidth,
      }

  const totalFixedWidth = fixedColumnsWidth * numFixedColumns + modifyTimeWidth + gapWidth * numGaps
  const nameWidth = Math.max(100, containerWidth - totalFixedWidth - scrollbarWidth)

  return {
    name: nameWidth,
    permissions: permissionsWidth,
    owner: ownerWidth,
    size: fixedColumnsWidth,
    modifyTime: modifyTimeWidth,
  }
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
        [resizingColumn]: Math.max(50, newWidth),
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

    const gapWidth = 6
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
      const scrollbarWidth = Math.max(currentScrollbarWidth, 17)
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
