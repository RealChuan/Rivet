import { useEffect, useEffectEvent, useRef, useState } from 'react'

import type { FileInfo } from '@shared/types/index.js'
import { computeDragSelectionIndices } from '../virtualization/layout.js'

interface Point {
  x: number
  y: number
}

interface UseFileDragSelectOptions {
  entries: FileInfo[]
  columns: number
  cellWidth: number
  rowHeight: number
  scrollContainerRef: React.RefObject<HTMLElement | null>
  onDragStart?: () => void
  onDragSelect?: (paths: string[]) => void
}

interface UseFileDragSelectReturn {
  isDragging: boolean
  hasStartedDrag: boolean
  dragSelection: Set<string>
  handleMouseDown: (e: React.MouseEvent) => void
  getDragStyle: () => React.CSSProperties
}

const SCROLL_ZONE_SIZE = 40
const MAX_SCROLL_SPEED = 15
const MIN_DRAG_DISTANCE = 5

function getRowCount(entryCount: number, columns: number): number {
  return Math.ceil(entryCount / Math.max(1, columns))
}

/** Max Y in content coords: rows total height or container visible height, whichever is larger */
function getMaxContentY(rows: number, rowHeight: number, containerHeight: number): number {
  return Math.max(rows * rowHeight, containerHeight)
}

/** Convert viewport client coords to scroll container content coords, clamping Y to [0, maxY] */
function clientToContent(
  clientX: number,
  clientY: number,
  container: HTMLElement,
  maxY: number,
): Point {
  const rect = container.getBoundingClientRect()
  const rawY = clientY - rect.top + container.scrollTop
  return {
    x: clientX - rect.left + container.scrollLeft,
    y: Math.max(0, Math.min(maxY, rawY)),
  }
}

function dragDistance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
}

function selectPaths(
  dragStart: Point,
  dragEnd: Point,
  options: { entries: FileInfo[]; columns: number; cellWidth: number; rowHeight: number },
): string[] {
  const indices = computeDragSelectionIndices({
    start: dragStart,
    end: dragEnd,
    rowHeight: options.rowHeight,
    cellWidth: options.cellWidth,
    columns: options.columns,
    entryCount: options.entries.length,
  })

  return indices
    .map((index) => options.entries[index]?.absolutePath)
    .filter((path): path is string => path !== undefined)
}

export function useFileDragSelect(options: UseFileDragSelectOptions): UseFileDragSelectReturn {
  const { entries, columns, cellWidth, rowHeight, scrollContainerRef, onDragStart, onDragSelect } =
    options

  const [isDragging, setIsDragging] = useState(false)
  const [hasStartedDrag, setHasStartedDrag] = useState(false)
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 })
  const [dragEnd, setDragEnd] = useState<Point>({ x: 0, y: 0 })
  const [dragSelection, setDragSelection] = useState<Set<string>>(new Set())

  const isDraggingRef = useRef(isDragging)
  const hasStartedDragRef = useRef(hasStartedDrag)
  const dragStartRef = useRef(dragStart)
  const dragEndRef = useRef(dragEnd)
  const entriesRef = useRef<FileInfo[]>(entries)
  const geometryRef = useRef({ columns, cellWidth, rowHeight })
  const lastMouseClientRef = useRef<Point>({ x: 0, y: 0 })
  const scrollRafRef = useRef<number | null>(null)

  const callDragStart = useEffectEvent(() => {
    onDragStart?.()
  })
  const callDragSelect = useEffectEvent((paths: string[]) => {
    onDragSelect?.(paths)
  })

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    if ((e.target as HTMLElement).closest('[data-file-list-header]')) return

    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const rows = getRowCount(entries.length, columns)
    const maxY = getMaxContentY(rows, rowHeight, scrollContainer.clientHeight)
    const point = clientToContent(e.clientX, e.clientY, scrollContainer, maxY)

    setIsDragging(true)
    setHasStartedDrag(false)
    setDragStart(point)
    setDragEnd(point)
    setDragSelection(new Set())

    isDraggingRef.current = true
    hasStartedDragRef.current = false
    dragStartRef.current = point
    dragEndRef.current = point
    entriesRef.current = entries
    geometryRef.current = { columns, cellWidth, rowHeight }
    lastMouseClientRef.current = { x: e.clientX, y: e.clientY }
  }

  const getDragStyle = (): React.CSSProperties => ({
    left: Math.min(dragStart.x, dragEnd.x),
    top: Math.min(dragStart.y, dragEnd.y),
    width: Math.abs(dragEnd.x - dragStart.x),
    height: Math.abs(dragEnd.y - dragStart.y),
  })

  useEffect(() => {
    const stopAutoScroll = () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = null
      }
    }

    const startAutoScroll = () => {
      const scrollEl = scrollContainerRef.current
      if (!scrollEl) return

      const doScroll = () => {
        if (!isDraggingRef.current || !scrollContainerRef.current) {
          scrollRafRef.current = null
          return
        }

        const currentScrollEl = scrollContainerRef.current
        const rect = currentScrollEl.getBoundingClientRect()
        const mouseY = lastMouseClientRef.current.y

        const distanceFromTop = mouseY - rect.top
        const distanceFromBottom = rect.bottom - mouseY

        let scrollDelta = 0

        if (distanceFromTop < SCROLL_ZONE_SIZE) {
          scrollDelta =
            distanceFromTop < 0
              ? -MAX_SCROLL_SPEED
              : -MAX_SCROLL_SPEED * (1 - distanceFromTop / SCROLL_ZONE_SIZE)
        } else if (distanceFromBottom < SCROLL_ZONE_SIZE) {
          scrollDelta =
            distanceFromBottom < 0
              ? MAX_SCROLL_SPEED
              : MAX_SCROLL_SPEED * (1 - distanceFromBottom / SCROLL_ZONE_SIZE)
        }

        if (scrollDelta !== 0) {
          const maxScrollTop = Math.max(
            0,
            currentScrollEl.scrollHeight - currentScrollEl.clientHeight,
          )
          const currentScrollTop = currentScrollEl.scrollTop
          const newScrollTop = Math.max(0, Math.min(maxScrollTop, currentScrollTop + scrollDelta))
          const clampedDelta = newScrollTop - currentScrollTop

          if (clampedDelta !== 0) {
            currentScrollEl.scrollBy(0, clampedDelta)
          }

          const geometry = geometryRef.current
          const maxY = getMaxContentY(
            getRowCount(entriesRef.current.length, geometry.columns),
            geometry.rowHeight,
            currentScrollEl.clientHeight,
          )
          const newDragEnd = clientToContent(
            lastMouseClientRef.current.x,
            lastMouseClientRef.current.y,
            currentScrollEl,
            maxY,
          )

          dragEndRef.current = newDragEnd
          setDragEnd(newDragEnd)

          const currentDragStart = dragStartRef.current
          if (dragDistance(currentDragStart, newDragEnd) >= MIN_DRAG_DISTANCE) {
            setDragSelection(
              new Set(
                selectPaths(currentDragStart, newDragEnd, {
                  entries: entriesRef.current,
                  ...geometry,
                }),
              ),
            )
          }
        }

        scrollRafRef.current = requestAnimationFrame(doScroll)
      }

      scrollRafRef.current = requestAnimationFrame(doScroll)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !scrollContainerRef.current) return

      const scrollEl = scrollContainerRef.current
      const geometry = geometryRef.current
      const maxY = getMaxContentY(
        getRowCount(entriesRef.current.length, geometry.columns),
        geometry.rowHeight,
        scrollEl.clientHeight,
      )
      const point = clientToContent(e.clientX, e.clientY, scrollEl, maxY)

      lastMouseClientRef.current = { x: e.clientX, y: e.clientY }

      const currentDragStart = dragStartRef.current
      const currentHasStartedDrag = hasStartedDragRef.current

      setDragEnd(point)
      dragEndRef.current = point

      const distance = dragDistance(currentDragStart, point)

      if (distance < MIN_DRAG_DISTANCE) {
        return
      }

      if (!currentHasStartedDrag) {
        setHasStartedDrag(true)
        hasStartedDragRef.current = true
        callDragStart()
      }

      setDragSelection(
        new Set(
          selectPaths(currentDragStart, point, {
            entries: entriesRef.current,
            ...geometry,
          }),
        ),
      )

      const rect = scrollEl.getBoundingClientRect()
      const distanceFromTop = e.clientY - rect.top
      const distanceFromBottom = rect.bottom - e.clientY
      const inScrollZone =
        distanceFromTop < SCROLL_ZONE_SIZE || distanceFromBottom < SCROLL_ZONE_SIZE

      if (inScrollZone && scrollRafRef.current === null) {
        startAutoScroll()
      } else if (!inScrollZone) {
        stopAutoScroll()
      }
    }

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return

      stopAutoScroll()

      if (!hasStartedDragRef.current) {
        setIsDragging(false)
        isDraggingRef.current = false
        return
      }

      const paths = selectPaths(dragStartRef.current, dragEndRef.current, {
        entries: entriesRef.current,
        ...geometryRef.current,
      })
      callDragSelect(paths)

      setDragSelection(new Set())
      setIsDragging(false)
      setHasStartedDrag(false)

      isDraggingRef.current = false
      hasStartedDragRef.current = false
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      stopAutoScroll()
    }
  }, [scrollContainerRef])

  return {
    isDragging,
    hasStartedDrag,
    dragSelection,
    handleMouseDown,
    getDragStyle,
  }
}
