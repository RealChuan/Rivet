import type React from 'react'
import * as Dialog from '@radix-ui/react-dialog'

import { useDraggable } from '@renderer/hooks/use-draggable.js'
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
  const { elementRef, dragPosition, handleMouseDown } = useDraggable({ width, height })

  return (
    <Dialog.Content
      ref={elementRef}
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
