import { useState, useRef, useEffect } from 'react'
import type { FileInfo } from '@shared/types/index.js'

interface Point {
  x: number
  y: number
}

interface UseFileDragSelectOptions {
  items: FileInfo[]
  itemHeight: number
  headerHeight?: number
  containerRef: React.RefObject<HTMLDivElement | null>
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

export function useFileDragSelect(options: UseFileDragSelectOptions): UseFileDragSelectReturn {
  const { items, itemHeight, headerHeight = 0, containerRef, onDragStart, onDragSelect } = options

  const [isDragging, setIsDragging] = useState(false)
  const [hasStartedDrag, setHasStartedDrag] = useState(false)
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 })
  const [dragEnd, setDragEnd] = useState<Point>({ x: 0, y: 0 })
  const [dragSelection, setDragSelection] = useState<Set<string>>(new Set())

  const isDraggingRef = useRef(isDragging)
  isDraggingRef.current = isDragging

  const hasStartedDragRef = useRef(hasStartedDrag)
  hasStartedDragRef.current = hasStartedDrag

  const dragStartRef = useRef(dragStart)
  dragStartRef.current = dragStart

  const dragEndRef = useRef(dragEnd)
  dragEndRef.current = dragEnd

  const itemsRef = useRef(items)
  itemsRef.current = items

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    if ((e.target as HTMLElement).closest('[data-file-list-header]')) return

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // 不允许在 header 区域开始框选
    if (y < headerHeight) return

    setIsDragging(true)
    setHasStartedDrag(false)
    setDragStart({ x, y })
    setDragEnd({ x, y })
    setDragSelection(new Set())
    onDragStart?.()
  }

  const getDragStyle = (): React.CSSProperties => {
    return {
      left: Math.min(dragStart.x, dragEnd.x),
      top: Math.max(headerHeight, Math.min(dragStart.y, dragEnd.y)),
      width: Math.abs(dragEnd.x - dragStart.x),
      height:
        Math.abs(dragEnd.y - dragStart.y) -
        Math.max(0, headerHeight - Math.min(dragStart.y, dragEnd.y)),
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return

      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const scrollLeft = container.scrollLeft
      const scrollTop = container.scrollTop

      const x = e.clientX - rect.left + scrollLeft
      const y = e.clientY - rect.top + scrollTop

      const currentDragStart = dragStartRef.current
      const currentHasStartedDrag = hasStartedDragRef.current

      setDragEnd({ x, y })

      const startX = Math.min(currentDragStart.x, x)
      const endX = Math.max(currentDragStart.x, x)
      const startY = Math.min(currentDragStart.y, y)
      const endY = Math.max(currentDragStart.y, y)

      const minDragDistance = 5
      const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))

      if (distance < minDragDistance) {
        return
      }

      if (!currentHasStartedDrag) {
        setHasStartedDrag(true)
      }

      const currentItems = itemsRef.current
      const listStartY = startY - headerHeight
      const listEndY = endY - headerHeight
      const startIndex = Math.max(0, Math.floor(listStartY / itemHeight))
      const endIndex = Math.min(currentItems.length, Math.ceil(listEndY / itemHeight))

      const newPendingSelection = new Set<string>()
      for (let i = startIndex; i < endIndex && i < currentItems.length; i++) {
        const file = currentItems[i]
        if (file) {
          newPendingSelection.add(file.name)
        }
      }

      setDragSelection(newPendingSelection)
    }

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return

      const currentHasStartedDrag = hasStartedDragRef.current
      const currentDragStart = dragStartRef.current
      const currentDragEnd = dragEndRef.current

      if (!currentHasStartedDrag) {
        setIsDragging(false)
        return
      }

      const startY = Math.min(currentDragStart.y, currentDragEnd.y)
      const endY = Math.max(currentDragStart.y, currentDragEnd.y)

      const currentItems = itemsRef.current
      const listStartY = startY - headerHeight
      const listEndY = endY - headerHeight
      const startIndex = Math.max(0, Math.floor(listStartY / itemHeight))
      const endIndex = Math.min(currentItems.length, Math.ceil(listEndY / itemHeight))

      const selectedInBox: FileInfo[] = []
      for (let i = startIndex; i < endIndex && i < currentItems.length; i++) {
        const file = currentItems[i]
        if (file) {
          selectedInBox.push(file)
        }
      }

      onDragSelect?.(selectedInBox)

      setDragSelection(new Set())
      setIsDragging(false)
      setHasStartedDrag(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [itemHeight, headerHeight, containerRef, onDragSelect])

  return {
    isDragging,
    hasStartedDrag,
    dragSelection,
    handleMouseDown,
    getDragStyle,
  }
}
