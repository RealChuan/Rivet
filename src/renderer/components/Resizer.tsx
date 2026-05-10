import React, { useState } from 'react'

interface ResizerProps {
  isDragging: boolean
  onMouseDown: () => void
}

export const Resizer: React.FC<ResizerProps> = ({ isDragging, onMouseDown }) => {
  const [isHovered, setIsHovered] = useState(false)
  const isActive = isDragging || isHovered

  return (
    <div
      className={`
        resizer flex items-center justify-center h-full
        cursor-col-resize transition-colors duration-150
      `}
      style={{ width: '4px' }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`
          h-full w-px transition-all duration-150
          ${isActive ? 'bg-accent' : 'bg-transparent'}
        `}
      />
      <div
        className={`
          absolute w-0.75 h-6 rounded-sm bg-accent
          transition-all duration-150
          ${isActive ? 'opacity-100' : 'opacity-30'}
        `}
      />
    </div>
  )
}
