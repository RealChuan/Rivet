import type React from 'react'
import { Dialog } from 'radix-ui'

import { DIALOG_SIZE } from '@shared/constants/index.js'
import { useDraggable } from '../../hooks/use-draggable.js'
import { useResizable } from '../../hooks/use-resizable.js'
import { cn } from '../../utils/index.js'

interface GlassDialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  width?: number
  height?: number
  /** 支持右下角拖拽改变尺寸；开启后内容区由子元素自己滚动 */
  resizable?: boolean
  minWidth?: number
  minHeight?: number
}

export const GlassDialog = ({
  open,
  onClose,
  children,
  width = DIALOG_SIZE.STANDARD.width,
  height = DIALOG_SIZE.STANDARD.height,
  resizable = false,
  minWidth = DIALOG_SIZE.STANDARD.width,
  minHeight = 280,
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
        <DialogContent
          width={width}
          height={height}
          resizable={resizable}
          minWidth={minWidth}
          minHeight={minHeight}
        >
          {children}
        </DialogContent>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface DialogContentProps {
  width: number
  height: number
  resizable: boolean
  minWidth: number
  minHeight: number
  children: React.ReactNode
}

const DialogContent = ({
  width,
  height,
  resizable,
  minWidth,
  minHeight,
  children,
}: DialogContentProps) => {
  const { size, isResizing, handleResizeStart } = useResizable({
    initialWidth: width,
    initialHeight: height,
    minWidth,
    minHeight,
  })
  const dialogWidth = resizable ? size.width : width
  const dialogHeight = resizable ? size.height : height
  const { elementRef, dragPosition, handleMouseDown } = useDraggable({
    width: dialogWidth,
    height: dialogHeight,
  })

  return (
    <div
      className="fixed z-50 max-w-[calc(100vw-32px)]"
      style={{
        left: dragPosition ? dragPosition.x : '50%',
        top: dragPosition ? dragPosition.y : '50%',
        transform: dragPosition ? undefined : 'translate(-50%, -50%)',
        width: `${dialogWidth}px`,
      }}
    >
      <Dialog.Content
        ref={elementRef}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className={cn(
          'relative box-border w-full rounded-xl',
          // 上下留白放在外层，滚动条才会跟着内缩、不压到圆角。
          resizable ? 'flex flex-col overflow-hidden p-6' : 'overflow-hidden py-6',
          'bg-glass-bg border border-glass-border shadow-dialog',
        )}
        style={resizable ? { height: `${dialogHeight}px` } : undefined}
        onMouseDown={handleMouseDown}
      >
        {resizable ? (
          children
        ) : (
          <div className="max-h-[calc(100vh-144px)] overflow-x-hidden overflow-y-auto px-6">
            {children}
          </div>
        )}

        {resizable && (
          <div
            data-testid="dialog-resize-handle"
            aria-hidden="true"
            onPointerDown={handleResizeStart}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              'absolute right-1 bottom-1 w-4 h-4 flex items-end justify-end',
              'cursor-nwse-resize text-text-muted/50 hover:text-text-muted transition-colors',
              isResizing && 'text-accent',
            )}
          >
            {/* 两道斜线贴合圆角，避免出现与容器圆角冲突的直角 */}
            <svg viewBox="0 0 8 8" className="w-2.5 h-2.5" fill="none" stroke="currentColor">
              <path d="M7 2.5 2.5 7" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M7 5.25 5.25 7" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </Dialog.Content>
    </div>
  )
}

export default GlassDialog
