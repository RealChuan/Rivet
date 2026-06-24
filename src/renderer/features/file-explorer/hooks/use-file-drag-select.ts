import { useEffect, useRef, useState } from 'react'
import type { FileInfo } from '@shared/types/index.js'

interface Point {
  x: number
  y: number
}

interface UseFileDragSelectOptions {
  items: FileInfo[]
  itemHeight: number
  scrollContainerRef: React.RefObject<HTMLElement | null>
  onDragStart?: () => void
  onDragSelect?: (files: FileInfo[]) => void
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

/** Max Y in content coords: items total height or container visible height, whichever is larger */
function getMaxContentY(itemsLength: number, itemHeight: number, containerHeight: number): number {
  return Math.max(itemsLength * itemHeight, containerHeight)
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

/** Euclidean distance between two points */
function dragDistance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
}

/** Compute the set of file names whose rows overlap the drag rectangle */
function computeFileSelection(
  dragStart: Point,
  dragEnd: Point,
  items: FileInfo[],
  itemHeight: number,
): Set<string> {
  const startY = Math.min(dragStart.y, dragEnd.y)
  const endY = Math.max(dragStart.y, dragEnd.y)
  const startIndex = Math.max(0, Math.floor(startY / itemHeight))
  const endIndex = Math.min(items.length, Math.ceil(endY / itemHeight))

  const selection = new Set<string>()
  for (let i = startIndex; i < endIndex; i++) {
    const file = items[i]
    if (file) {
      selection.add(file.name)
    }
  }
  return selection
}

/** Collect FileInfo[] for files whose names are in the selection set, preserving order */
function selectFilesByName(items: FileInfo[], names: Set<string>): FileInfo[] {
  const result: FileInfo[] = []
  for (const file of items) {
    if (names.has(file.name)) {
      result.push(file)
    }
  }
  return result
}

export function useFileDragSelect(options: UseFileDragSelectOptions): UseFileDragSelectReturn {
  const { items, itemHeight, scrollContainerRef, onDragStart, onDragSelect } = options

  const [isDragging, setIsDragging] = useState(false)
  const [hasStartedDrag, setHasStartedDrag] = useState(false)
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 })
  const [dragEnd, setDragEnd] = useState<Point>({ x: 0, y: 0 })
  const [dragSelection, setDragSelection] = useState<Set<string>>(new Set())

  const isDraggingRef = useRef(isDragging)
  const hasStartedDragRef = useRef(hasStartedDrag)
  const dragStartRef = useRef(dragStart)
  const dragEndRef = useRef(dragEnd)
  const dragItemsRef = useRef<FileInfo[]>(items)
  const onDragStartRef = useRef(onDragStart)
  const onDragSelectRef = useRef(onDragSelect)
  const lastMouseClientRef = useRef<Point>({ x: 0, y: 0 })
  const scrollRafRef = useRef<number | null>(null)

  useEffect(() => {
    isDraggingRef.current = isDragging
    hasStartedDragRef.current = hasStartedDrag
    dragStartRef.current = dragStart
    dragEndRef.current = dragEnd
    onDragStartRef.current = onDragStart
    onDragSelectRef.current = onDragSelect
  })

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    if ((e.target as HTMLElement).closest('[data-file-list-header]')) return

    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const maxY = getMaxContentY(items.length, itemHeight, scrollContainer.clientHeight)
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
    dragItemsRef.current = items
    lastMouseClientRef.current = { x: e.clientX, y: e.clientY }
  }

  const getDragStyle = (): React.CSSProperties => {
    return {
      left: Math.min(dragStart.x, dragEnd.x),
      top: Math.min(dragStart.y, dragEnd.y),
      width: Math.abs(dragEnd.x - dragStart.x),
      height: Math.abs(dragEnd.y - dragStart.y),
    }
  }

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

          const currentItems = dragItemsRef.current
          const maxY = getMaxContentY(currentItems.length, itemHeight, currentScrollEl.clientHeight)
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
              computeFileSelection(currentDragStart, newDragEnd, currentItems, itemHeight),
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
      const currentItems = dragItemsRef.current
      const maxY = getMaxContentY(currentItems.length, itemHeight, scrollEl.clientHeight)
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
        onDragStartRef.current?.()
      }

      setDragSelection(computeFileSelection(currentDragStart, point, currentItems, itemHeight))

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

      const currentHasStartedDrag = hasStartedDragRef.current

      if (!currentHasStartedDrag) {
        setIsDragging(false)
        isDraggingRef.current = false
        return
      }

      const currentItems = dragItemsRef.current
      const names = computeFileSelection(
        dragStartRef.current,
        dragEndRef.current,
        currentItems,
        itemHeight,
      )
      onDragSelectRef.current?.(selectFilesByName(currentItems, names))

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
  }, [itemHeight, scrollContainerRef])

  return {
    isDragging,
    hasStartedDrag,
    dragSelection,
    handleMouseDown,
    getDragStyle,
  }
}
