import type React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useRef, useState } from 'react'

import { cn } from '@renderer/utils/index.js'
import { DIALOG_SIZE } from '@shared/constants/index.js'

interface GlassDialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  width?: number
  height?: number
}

export const GlassDialog = ({
  open,
  onClose,
  children,
  width = DIALOG_SIZE.STANDARD.width,
  height = DIALOG_SIZE.STANDARD.height,
}: GlassDialogProps) => {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-overlay z-50" />
        <DialogContent width={width} height={height}>
          {children}
        </DialogContent>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface DialogContentProps {
  width: number
  height: number
  children: React.ReactNode
}

const DialogContent = ({ width, height, children }: DialogContentProps) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const dragStart = useRef({ mouseX: 0, mouseY: 0, dialogX: 0, dialogY: 0 })

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, input, textarea, select')) return

    const rect = dialogRef.current?.getBoundingClientRect()
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      dialogX: rect?.left ?? (window.innerWidth - width) / 2,
      dialogY: rect?.top ?? (window.innerHeight - height) / 2,
    }

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - dragStart.current.mouseX
      const deltaY = ev.clientY - dragStart.current.mouseY
      setDragPosition({
        x: Math.max(0, Math.min(window.innerWidth - width, dragStart.current.dialogX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - height, dragStart.current.dialogY + deltaY)),
      })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <Dialog.Content
      ref={dialogRef}
      onPointerDownOutside={(e) => e.preventDefault()}
      onInteractOutside={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
      className={cn(
        'fixed backdrop-blur-2xl rounded-xl p-6 max-w-full max-h-[calc(100vh-96px)]',
        'box-border overflow-y-auto overflow-x-hidden',
        'bg-glass-bg shadow-dialog z-50',
      )}
      onMouseDown={handleMouseDown}
      style={{
        left: dragPosition ? dragPosition.x : '50%',
        top: dragPosition ? dragPosition.y : '50%',
        transform: dragPosition ? undefined : 'translate(-50%, -50%)',
        width: `${width}px`,
      }}
    >
      {children}
    </Dialog.Content>
  )
}

export default GlassDialog
