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

export interface UseFileDragSelectReturn {
  isDragging: boolean
  hasStartedDrag: boolean
  dragSelection: Set<string>
  handleMouseDown: (e: React.MouseEvent) => void
  getDragStyle: () => React.CSSProperties
}

const SCROLL_ZONE_SIZE = 40
const MAX_SCROLL_SPEED = 15
const MIN_DRAG_DISTANCE = 5

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
  const itemsRef = useRef(items)
  const onDragStartRef = useRef(onDragStart)
  const onDragSelectRef = useRef(onDragSelect)
  const lastMouseClientRef = useRef<Point>({ x: 0, y: 0 })
  const scrollRafRef = useRef<number | null>(null)

  useEffect(() => {
    isDraggingRef.current = isDragging
    hasStartedDragRef.current = hasStartedDrag
    dragStartRef.current = dragStart
    dragEndRef.current = dragEnd
    itemsRef.current = items
    onDragStartRef.current = onDragStart
    onDragSelectRef.current = onDragSelect
  })

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    if ((e.target as HTMLElement).closest('[data-file-list-header]')) return

    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const rect = scrollContainer.getBoundingClientRect()
    const scrollLeft = scrollContainer.scrollLeft
    const scrollTop = scrollContainer.scrollTop

    const maxContentY = items.length * itemHeight
    const x = e.clientX - rect.left + scrollLeft
    const rawY = e.clientY - rect.top + scrollTop
    const y = Math.max(0, Math.min(maxContentY, rawY))

    setIsDragging(true)
    setHasStartedDrag(false)
    setDragStart({ x, y })
    setDragEnd({ x, y })
    setDragSelection(new Set())

    isDraggingRef.current = true
    hasStartedDragRef.current = false
    dragStartRef.current = { x, y }
    dragEndRef.current = { x, y }
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
    const computeSelection = (
      currentDragStart: Point,
      currentDragEnd: Point,
      currentItems: FileInfo[]
    ): Set<string> => {
      const startY = Math.min(currentDragStart.y, currentDragEnd.y)
      const endY = Math.max(currentDragStart.y, currentDragEnd.y)
      const startIndex = Math.max(0, Math.floor(startY / itemHeight))
      const endIndex = Math.min(currentItems.length, Math.ceil(endY / itemHeight))

      const selection = new Set<string>()
      for (let i = startIndex; i < endIndex && i < currentItems.length; i++) {
        const file = currentItems[i]
        if (file) {
          selection.add(file.name)
        }
      }
      return selection
    }

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
          if (distanceFromTop < 0) {
            // Mouse is above the container — scroll up at max speed
            scrollDelta = -MAX_SCROLL_SPEED
          } else {
            scrollDelta = -MAX_SCROLL_SPEED * (1 - distanceFromTop / SCROLL_ZONE_SIZE)
          }
        } else if (distanceFromBottom < SCROLL_ZONE_SIZE) {
          if (distanceFromBottom < 0) {
            // Mouse is below the container — scroll down at max speed
            scrollDelta = MAX_SCROLL_SPEED
          } else {
            scrollDelta = MAX_SCROLL_SPEED * (1 - distanceFromBottom / SCROLL_ZONE_SIZE)
          }
        }

        if (scrollDelta !== 0) {
          const maxScrollTop = Math.max(
            0,
            currentScrollEl.scrollHeight - currentScrollEl.clientHeight
          )
          const currentScrollTop = currentScrollEl.scrollTop
          const newScrollTop = Math.max(0, Math.min(maxScrollTop, currentScrollTop + scrollDelta))
          const clampedDelta = newScrollTop - currentScrollTop

          if (clampedDelta !== 0) {
            currentScrollEl.scrollBy(0, clampedDelta)
          }

          const scrollLeft = currentScrollEl.scrollLeft
          const scrollTop = currentScrollEl.scrollTop
          const x = lastMouseClientRef.current.x - rect.left + scrollLeft

          const currentItems = itemsRef.current
          const maxContentY = currentItems.length * itemHeight
          const rawY = lastMouseClientRef.current.y - rect.top + scrollTop
          const y = Math.max(0, Math.min(maxContentY, rawY))

          const newDragEnd = { x, y }
          dragEndRef.current = newDragEnd
          setDragEnd(newDragEnd)

          const currentDragStart = dragStartRef.current
          const startX = Math.min(currentDragStart.x, x)
          const endX = Math.max(currentDragStart.x, x)
          const startY = Math.min(currentDragStart.y, y)
          const endY = Math.max(currentDragStart.y, y)

          const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))
          if (distance >= MIN_DRAG_DISTANCE) {
            setDragSelection(computeSelection(currentDragStart, newDragEnd, currentItems))
          }
        }

        scrollRafRef.current = requestAnimationFrame(doScroll)
      }

      scrollRafRef.current = requestAnimationFrame(doScroll)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !scrollContainerRef.current) return

      const scrollEl = scrollContainerRef.current
      const rect = scrollEl.getBoundingClientRect()
      const scrollLeft = scrollEl.scrollLeft
      const scrollTop = scrollEl.scrollTop

      const currentItems = itemsRef.current
      const x = e.clientX - rect.left + scrollLeft
      const maxContentY = currentItems.length * itemHeight
      const rawY = e.clientY - rect.top + scrollTop
      const y = Math.max(0, Math.min(maxContentY, rawY))

      lastMouseClientRef.current = { x: e.clientX, y: e.clientY }

      const currentDragStart = dragStartRef.current
      const currentHasStartedDrag = hasStartedDragRef.current

      setDragEnd({ x, y })
      dragEndRef.current = { x, y }

      const startX = Math.min(currentDragStart.x, x)
      const endX = Math.max(currentDragStart.x, x)
      const startY = Math.min(currentDragStart.y, y)
      const endY = Math.max(currentDragStart.y, y)

      const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))

      if (distance < MIN_DRAG_DISTANCE) {
        return
      }

      if (!currentHasStartedDrag) {
        setHasStartedDrag(true)
        hasStartedDragRef.current = true
        onDragStartRef.current?.()
      }

      setDragSelection(computeSelection(currentDragStart, { x, y }, currentItems))

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
      const currentDragStart = dragStartRef.current
      const currentDragEnd = dragEndRef.current

      if (!currentHasStartedDrag) {
        setIsDragging(false)
        isDraggingRef.current = false
        return
      }

      const currentItems = itemsRef.current
      const selectedInBox: FileInfo[] = []

      const startY = Math.min(currentDragStart.y, currentDragEnd.y)
      const endY = Math.max(currentDragStart.y, currentDragEnd.y)
      const startIndex = Math.max(0, Math.floor(startY / itemHeight))
      const endIndex = Math.min(currentItems.length, Math.ceil(endY / itemHeight))

      for (let i = startIndex; i < endIndex && i < currentItems.length; i++) {
        const file = currentItems[i]
        if (file) {
          selectedInBox.push(file)
        }
      }

      onDragSelectRef.current?.(selectedInBox)

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
