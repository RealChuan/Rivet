import React, { useState, useEffect, useCallback, useRef } from 'react'

interface GlassDialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export const GlassDialog: React.FC<GlassDialogProps> = ({ open, onClose, children }) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startPos, setStartPos] = useState({ mouseX: 0, mouseY: 0, dialogX: 0, dialogY: 0 })
  const [customPosition, setCustomPosition] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (open) {
      setCustomPosition(null)
    }
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
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
        currentDialogX = (window.innerWidth - 420) / 2
        currentDialogY = (window.innerHeight - 400) / 2
      }

      setStartPos({
        mouseX: e.clientX,
        mouseY: e.clientY,
        dialogX: currentDialogX,
        dialogY: currentDialogY,
      })
    },
    [customPosition]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.mouseX
      const deltaY = e.clientY - startPos.mouseY
      setCustomPosition({
        x: Math.max(0, Math.min(window.innerWidth - 360, startPos.dialogX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 200, startPos.dialogY + deltaY)),
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, startPos])

  if (!open) return null

  return (
    <div className="glass-dialog">
      <div
        ref={dialogRef}
        className="dialog-container"
        onMouseDown={handleMouseDown}
        style={{
          position: customPosition ? 'absolute' : undefined,
          left: customPosition?.x,
          top: customPosition?.y,
          cursor: isDragging ? 'move' : 'default',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default GlassDialog
