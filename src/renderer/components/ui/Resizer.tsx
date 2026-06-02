import type React from 'react'
import { useState } from 'react'

interface ResizerProps {
  isDragging: boolean
  onMouseDown: (e: React.MouseEvent) => void
}

export const Resizer: React.FC<ResizerProps> = ({ isDragging, onMouseDown }) => {
  const [isHovered, setIsHovered] = useState(false)
  const isActive = isDragging || isHovered

  return (
    <div
      className="flex items-center justify-center h-full cursor-col-resize"
      style={{ width: '5px' }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`
          h-full w-px transition-colors duration-150
          ${isActive ? 'bg-accent/30' : 'bg-border'}
        `}
      />
      <div
        className={`
          absolute w-0.5 h-5 rounded-full bg-accent
          transition-all duration-150
          ${isActive ? 'opacity-100' : 'opacity-0'}
        `}
      />
    </div>
  )
}
