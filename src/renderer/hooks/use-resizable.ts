import type React from 'react'
import { useEffect, useRef, useState } from 'react'

interface Size {
  width: number
  height: number
}

interface UseResizableOptions {
  initialWidth: number
  initialHeight: number
  minWidth: number
  minHeight: number
}

interface UseResizableResult {
  size: Size
  isResizing: boolean
  handleResizeStart: (e: React.PointerEvent) => void
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/** 视口内留白：右下角把手不贴边，避免拖出屏幕。 */
const VIEWPORT_MARGIN_X = 32
const VIEWPORT_MARGIN_Y = 96

/**
 * 右下角拖拽改变尺寸。与 useDraggable 同款做法：
 * 监听器在 effect 中随 isResizing 注册与清理，起点尺寸存在 ref 里避免每次移动重挂监听。
 */
export function useResizable({
  initialWidth,
  initialHeight,
  minWidth,
  minHeight,
}: UseResizableOptions): UseResizableResult {
  const [size, setSize] = useState<Size>({ width: initialWidth, height: initialHeight })
  const [isResizing, setIsResizing] = useState(false)
  const start = useRef({ x: 0, y: 0, width: initialWidth, height: initialHeight })

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    start.current = { x: e.clientX, y: e.clientY, width: size.width, height: size.height }
    setIsResizing(true)
  }

  useEffect(() => {
    if (!isResizing) return

    const handlePointerMove = (ev: PointerEvent) => {
      setSize({
        width: clamp(
          start.current.width + ev.clientX - start.current.x,
          minWidth,
          window.innerWidth - VIEWPORT_MARGIN_X,
        ),
        height: clamp(
          start.current.height + ev.clientY - start.current.y,
          minHeight,
          window.innerHeight - VIEWPORT_MARGIN_Y,
        ),
      })
    }

    const handlePointerUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isResizing, minWidth, minHeight])

  return { size, isResizing, handleResizeStart }
}
