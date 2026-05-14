import React, { useState, useCallback, useEffect } from 'react'
import { useUiStore } from '../stores/index.js'
import { Resizer } from '../components/ui/index.js'

interface ResizablePanelProps {
  sidebar: React.ReactNode
  content: React.ReactNode
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({ sidebar, content }) => {
  const { sidebarWidth, setSidebarWidth } = useUiStore()
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false)

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDraggingSidebar) {
        const newWidth = Math.max(180, Math.min(400, e.clientX))
        setSidebarWidth(newWidth)
      }
    },
    [isDraggingSidebar, setSidebarWidth]
  )

  const handleMouseUp = useCallback(() => {
    setIsDraggingSidebar(false)
  }, [])

  useEffect(() => {
    if (!isDraggingSidebar) return
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingSidebar, handleMouseMove, handleMouseUp])

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="shrink-0" style={{ width: sidebarWidth }}>
        {sidebar}
      </div>

      <Resizer isDragging={isDraggingSidebar} onMouseDown={() => setIsDraggingSidebar(true)} />

      <div className="flex-1 flex flex-col overflow-hidden">{content}</div>
    </div>
  )
}
