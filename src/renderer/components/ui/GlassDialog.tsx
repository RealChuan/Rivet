import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@renderer/utils/index.js'
import { DIALOG_SIZE } from '@shared/constants/index.js'

interface GlassDialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  width?: number
  height?: number
}

export const GlassDialog: React.FC<GlassDialogProps> = ({
  open,
  onClose,
  children,
  width = DIALOG_SIZE.STANDARD.width,
  height = DIALOG_SIZE.STANDARD.height,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startPos, setStartPos] = useState({ mouseX: 0, mouseY: 0, dialogX: 0, dialogY: 0 })
  const [customPosition, setCustomPosition] = useState<{ x: number; y: number } | null>(null)
  const [shouldRender, setShouldRender] = useState(open)
  const [isVisible, setIsVisible] = useState(false)

  // 渲染期间同步 state：当 open 变化时重置对话框状态
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    if (open) {
      setCustomPosition(null)
      setShouldRender(true)
    } else {
      setIsVisible(false)
      setShouldRender(false)
    }
    setPrevOpen(open)
  }

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      setIsVisible(true)
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, input, textarea, select')) return

    setIsDragging(true)
    let currentDialogX: number
    let currentDialogY: number

    if (customPosition) {
      currentDialogX = customPosition.x
      currentDialogY = customPosition.y
    } else if (dialogRef.current) {
      const rect = dialogRef.current.getBoundingClientRect()
      currentDialogX = rect.left
      currentDialogY = rect.top
    } else {
      currentDialogX = (window.innerWidth - width) / 2
      currentDialogY = (window.innerHeight - height) / 2
    }

    setStartPos({
      mouseX: e.clientX,
      mouseY: e.clientY,
      dialogX: currentDialogX,
      dialogY: currentDialogY,
    })
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.mouseX
      const deltaY = e.clientY - startPos.mouseY
      setCustomPosition({
        x: Math.max(0, Math.min(window.innerWidth - width, startPos.dialogX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - height, startPos.dialogY + deltaY)),
      })
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
  }, [height, isDragging, startPos, width])

  if (!shouldRender) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex items-center justify-center bg-overlay z-50 p-12 transition-opacity duration-200',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={cn(
          'backdrop-blur-2xl rounded-xl p-6 max-w-full max-h-[calc(100vh-96px)]',
          'relative box-border overflow-y-auto overflow-x-hidden',
          'bg-glass-bg shadow-dialog',
          'transition-all duration-200 ease-out',
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
        )}
        onMouseDown={handleMouseDown}
        style={{
          position: customPosition ? 'absolute' : undefined,
          left: customPosition?.x,
          top: customPosition?.y,
          cursor: isDragging ? 'move' : 'default',
          width: `${width}px`,
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

export default GlassDialog
