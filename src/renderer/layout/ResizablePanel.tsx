import React, { useState, useCallback, useEffect } from 'react'
import { useUiStore } from '../stores/index.js'
import { Resizer } from '../components/ui/index.js'

interface ResizablePanelProps {
  sidebar: React.ReactNode
  content: React.ReactNode
  queueDrawer?: React.ReactNode
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  sidebar,
  content,
  queueDrawer,
}) => {
  const { queueDrawerOpen, sidebarWidth, setSidebarWidth, queueDrawerWidth, setQueueDrawerWidth } =
    useUiStore()
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false)
  const [isDraggingQueue, setIsDraggingQueue] = useState(false)

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDraggingSidebar) {
        const newWidth = Math.max(180, Math.min(400, e.clientX))
        setSidebarWidth(newWidth)
      } else if (isDraggingQueue) {
        const newWidth = Math.max(200, Math.min(500, window.innerWidth - e.clientX))
        setQueueDrawerWidth(newWidth)
      }
    },
    [isDraggingSidebar, isDraggingQueue, setSidebarWidth, setQueueDrawerWidth]
  )

  const handleMouseUp = useCallback(() => {
    setIsDraggingSidebar(false)
    setIsDraggingQueue(false)
  }, [])

  useEffect(() => {
    if (isDraggingSidebar || isDraggingQueue) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDraggingSidebar, isDraggingQueue, handleMouseMove, handleMouseUp])

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="shrink-0" style={{ width: sidebarWidth }}>
        {sidebar}
      </div>

      <Resizer isDragging={isDraggingSidebar} onMouseDown={() => setIsDraggingSidebar(true)} />

      <div className="flex-1 flex flex-col overflow-hidden">{content}</div>

      {queueDrawerOpen && queueDrawer && (
        <>
          <Resizer isDragging={isDraggingQueue} onMouseDown={() => setIsDraggingQueue(true)} />
          <div className="shrink-0" style={{ width: queueDrawerWidth }}>
            {queueDrawer}
          </div>
        </>
      )}
    </div>
  )
}
