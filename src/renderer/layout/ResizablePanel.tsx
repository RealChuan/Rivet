import React, { useState, useEffect } from 'react'
import { useUiStore } from '../stores/index.js'
import { Resizer } from '../components/ui/index.js'

interface ResizablePanelProps {
  sidebar: React.ReactNode
  content: React.ReactNode
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({ sidebar, content }) => {
  const sidebarWidth = useUiStore(state => state.sidebarWidth)
  const setSidebarWidth = useUiStore(state => state.setSidebarWidth)
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false)

  useEffect(() => {
    if (!isDraggingSidebar) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(400, e.clientX))
      setSidebarWidth(newWidth)
    }
    const handleMouseUp = () => {
      setIsDraggingSidebar(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingSidebar, setSidebarWidth])

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="shrink-0 bg-sidebar-bg" style={{ width: sidebarWidth }}>
        {sidebar}
      </div>

      <Resizer isDragging={isDraggingSidebar} onMouseDown={() => setIsDraggingSidebar(true)} />

      <div className="flex-1 flex flex-col overflow-hidden">{content}</div>
    </div>
  )
}
