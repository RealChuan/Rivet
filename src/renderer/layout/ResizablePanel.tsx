import type React from 'react'
import { useEffect, useState } from 'react'
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from '@shared/constants/index.js'
import { Resizer } from '../components/ui/index.js'
import { useUiStore } from '../stores/index.js'

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
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, e.clientX))
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
