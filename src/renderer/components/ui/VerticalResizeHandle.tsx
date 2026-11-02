import type React from 'react'
import { MIN_QUEUE_PANEL_HEIGHT } from '@shared/constants/index.js'

interface VerticalResizeHandleProps {
  value: number
  onResize: (height: number) => void
  onReset: () => void
  label: string
}

const KEYBOARD_STEP = 16
const KEYBOARD_STEP_LARGE = 64

/**
 * 上下分栏的拖拽分隔条。
 * 只上报目标高度，钳制交给调用方——它才知道内容区的可用高度。
 */
export const VerticalResizeHandle = ({
  value,
  onResize,
  onReset,
  label,
}: VerticalResizeHandleProps) => {
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()

    const target = event.currentTarget
    const startY = event.clientY
    const startHeight = value
    target.setPointerCapture(event.pointerId)

    const handleMove = (moveEvent: PointerEvent) => {
      onResize(startHeight - (moveEvent.clientY - startY))
    }
    const handleEnd = () => {
      target.removeEventListener('pointermove', handleMove)
      target.removeEventListener('pointerup', handleEnd)
      target.removeEventListener('pointercancel', handleEnd)
    }

    target.addEventListener('pointermove', handleMove)
    target.addEventListener('pointerup', handleEnd)
    target.addEventListener('pointercancel', handleEnd)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      onResize(value + step)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      onResize(value - step)
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={MIN_QUEUE_PANEL_HEIGHT}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
      style={{ touchAction: 'none' }}
      className="group relative flex items-center justify-center h-1.25 w-full shrink-0 cursor-row-resize focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
    >
      <div className="w-full h-px bg-border group-hover:bg-accent/30" />
      <div className="absolute top-1/2 -translate-y-1/2 h-0.5 w-5 rounded-full bg-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </div>
  )
}
