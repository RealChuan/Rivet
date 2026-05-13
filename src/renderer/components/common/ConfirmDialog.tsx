import React from 'react'
import { useTranslation } from 'react-i18next'
import { GlassDialog } from '../ui/index.js'
import Button from '../../components/ui/Button.js'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
  title: string
  message?: string | React.ReactNode
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  customContent?: React.ReactNode
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText,
  cancelText,
  type = 'danger',
  customContent,
}) => {
  const { t } = useTranslation()

  const dialogConfig = {
    danger: {
      bgClass: 'bg-[rgba(241,76,76,0.1)]',
      colorClass: 'text-[#f14c4c]',
      buttonVariant: 'danger' as const,
      icon: (
        <svg className="w-5 h-5 stroke-danger stroke-2" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
    warning: {
      bgClass: 'bg-[rgba(219,187,20,0.1)]',
      colorClass: 'text-[#dcbb14]',
      buttonVariant: 'warning' as const,
      icon: (
        <svg className="w-5 h-5 stroke-warning stroke-2" viewBox="0 0 24 24" fill="none">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    info: {
      bgClass: 'bg-[rgba(59,130,246,0.1)]',
      colorClass: 'text-accent',
      buttonVariant: 'primary' as const,
      icon: (
        <svg className="w-5 h-5 stroke-accent stroke-2" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
    },
  }

  const config = dialogConfig[type]

  const handleConfirm = async () => {
    await onConfirm()
    onClose()
  }

  const handleCancel = async () => {
    if (onCancel) {
      await onCancel()
    }
    onClose()
  }

  return (
    <GlassDialog open={open} onClose={() => void handleCancel()}>
      <div className="flex flex-col items-center text-center">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${config.bgClass}`}
        >
          {config.icon}
        </div>
        <h2 className="text-base font-semibold text-text mb-2">{title}</h2>

        {customContent ? (
          <div className="w-full mb-5">{customContent}</div>
        ) : message ? (
          <p className="text-sm text-text-muted mb-5">{message}</p>
        ) : null}

        <div className="flex justify-end gap-2.5 w-full">
          <Button variant="secondary" onClick={() => void handleCancel()}>
            {cancelText ?? t('dialog.cancel')}
          </Button>
          <Button variant={config.buttonVariant} onClick={() => void handleConfirm()}>
            {confirmText ?? t('dialog.confirm')}
          </Button>
        </div>
      </div>
    </GlassDialog>
  )
}

export default ConfirmDialog
