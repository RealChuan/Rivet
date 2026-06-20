import type React from 'react'
import { useState } from 'react'

import { cn } from '@renderer/utils/index.js'

interface ResizerProps {
  isDragging: boolean
  onMouseDown: (e: React.MouseEvent) => void
}

export const Resizer = ({ isDragging, onMouseDown }: ResizerProps) => {
  const [isHovered, setIsHovered] = useState(false)
  const isActive = isDragging || isHovered

  return (
    <div
      className="relative flex items-center justify-center h-full cursor-col-resize"
      style={{ width: '5px' }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          'h-full w-px transition-colors duration-150',
          isActive ? 'bg-accent/30' : 'bg-border',
        )}
      />
      <div
        className={cn(
          'absolute left-1/2 -translate-x-1/2 w-0.5 h-5 rounded-full bg-accent',
          'transition-all duration-150',
          isActive ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
