import type React from 'react'
import { AlertCircle, TriangleAlert, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { logger } from '@renderer/utils/index.js'
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

const dialogConfig: Record<
  'danger' | 'warning' | 'info',
  {
    bgClass: string
    colorClass: string
    buttonVariant: 'danger' | 'warning' | 'primary'
    icon: React.ReactNode
  }
> = {
  danger: {
    bgClass: 'bg-danger-light',
    colorClass: 'text-danger',
    buttonVariant: 'danger',
    icon: <AlertCircle className="w-5 h-5 stroke-danger stroke-2" />,
  },
  warning: {
    bgClass: 'bg-warning-light',
    colorClass: 'text-warning',
    buttonVariant: 'warning',
    icon: <TriangleAlert className="w-5 h-5 stroke-warning stroke-2" />,
  },
  info: {
    bgClass: 'bg-accent-light',
    colorClass: 'text-accent',
    buttonVariant: 'primary',
    icon: <Info className="w-5 h-5 stroke-accent stroke-2" />,
  },
}

export const ConfirmationDialog = ({
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
}: ConfirmationDialogProps) => {
  const { t } = useTranslation()

  const config = dialogConfig[type]

  const handleConfirm = async () => {
    try {
      await onConfirm()
    } catch (error) {
      logger.catch(error, { action: 'confirmation-dialog-confirm' })
    } finally {
      onClose()
    }
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
            {cancelText ?? t(($) => $.common.action.cancel)}
          </Button>
          <Button variant={config.buttonVariant} onClick={() => void handleConfirm()}>
            {confirmText ?? t(($) => $.common.action.confirm)}
          </Button>
        </div>
      </div>
    </GlassDialog>
  )
}

export default ConfirmationDialog
