import type React from 'react'
import { AlertCircle, TriangleAlert, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button.js'
import { GlassDialog } from '../ui/index.js'

interface ConfirmationDialogProps {
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

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
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
      bgClass: 'bg-danger-light',
      colorClass: 'text-danger',
      buttonVariant: 'danger' as const,
      icon: <AlertCircle className="w-5 h-5 stroke-danger stroke-2" />,
    },
    warning: {
      bgClass: 'bg-warning-light',
      colorClass: 'text-warning',
      buttonVariant: 'warning' as const,
      icon: <TriangleAlert className="w-5 h-5 stroke-warning stroke-2" />,
    },
    info: {
      bgClass: 'bg-accent-light',
      colorClass: 'text-accent',
      buttonVariant: 'primary' as const,
      icon: <Info className="w-5 h-5 stroke-accent stroke-2" />,
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
            {cancelText ?? t('common.action.cancel')}
          </Button>
          <Button variant={config.buttonVariant} onClick={() => void handleConfirm()}>
            {confirmText ?? t('common.action.confirm')}
          </Button>
        </div>
      </div>
    </GlassDialog>
  )
}

export default ConfirmationDialog
