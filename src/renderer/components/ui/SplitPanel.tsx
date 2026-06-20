import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@renderer/stores/index.js'
import { MAX_PANEL_WIDTH, MIN_PANEL_WIDTH } from '@shared/constants/index.js'
import { Resizer } from './Resizer.js'

interface SplitPanelProps {
  left: React.ReactNode
  right: React.ReactNode
  widthSelector?: (state: ReturnType<typeof useUiStore.getState>) => number
  setWidthSelector?: (state: ReturnType<typeof useUiStore.getState>) => (width: number) => void
}

export const SplitPanel = ({
  left,
  right,
  widthSelector = (state) => state.connectionPanelWidth,
  setWidthSelector = (state) => state.setConnectionPanelWidth,
}: SplitPanelProps) => {
  const panelWidth = useUiStore(widthSelector)
  const setPanelWidth = useUiStore(setWidthSelector)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, width: 0 })

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartRef.current.x
      const newWidth = Math.max(
        MIN_PANEL_WIDTH,
        Math.min(MAX_PANEL_WIDTH, dragStartRef.current.width + delta),
      )
      setPanelWidth(newWidth)
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
  }, [isDragging, setPanelWidth])

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      <div
        className="shrink-0 h-full border-r border-border bg-transparent"
        style={{ width: panelWidth }}
      >
        {left}
      </div>

      <Resizer
        isDragging={isDragging}
        onMouseDown={(e) => {
          dragStartRef.current = { x: e.clientX, width: panelWidth }
          setIsDragging(true)
        }}
      />

      <div className="flex-1 flex flex-col overflow-hidden">{right}</div>
    </div>
  )
}
