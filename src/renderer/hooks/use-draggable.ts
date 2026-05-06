import type React from 'react'
import { useEffect, useRef, useState } from 'react'

interface DragPosition {
  x: number
  y: number
}

interface UseDraggableOptions {
  width: number
  height: number
}

interface UseDraggableResult {
  elementRef: React.RefObject<HTMLDivElement | null>
  dragPosition: DragPosition | null
  handleMouseDown: (e: React.MouseEvent) => void
}

/**
 * 管理可拖拽元素的鼠标监听器生命周期。
 * 监听器在 useEffect 中注册，组件卸载或拖拽结束时通过 cleanup 移除，避免泄漏。
 */
export function useDraggable({ width, height }: UseDraggableOptions): UseDraggableResult {
  const elementRef = useRef<HTMLDivElement>(null)
  const [dragPosition, setDragPosition] = useState<DragPosition | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ mouseX: 0, mouseY: 0, dialogX: 0, dialogY: 0 })

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target
    if (target instanceof HTMLElement && target.closest('button, input, textarea, select')) {
      return
    }

    const rect = elementRef.current?.getBoundingClientRect()
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      dialogX: rect?.left ?? (window.innerWidth - width) / 2,
      dialogY: rect?.top ?? (window.innerHeight - height) / 2,
    }
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - dragStart.current.mouseX
      const deltaY = ev.clientY - dragStart.current.mouseY
      setDragPosition({
        x: Math.max(0, Math.min(window.innerWidth - width, dragStart.current.dialogX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - height, dragStart.current.dialogY + deltaY)),
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, width, height])

  return { elementRef, dragPosition, handleMouseDown }
}
