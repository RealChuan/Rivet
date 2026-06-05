import type React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { XIcon } from '@renderer/components/common/XIcon.js'
import GlassDialog from '@renderer/components/ui/GlassDialog.js'
import { useUiStore } from '@renderer/stores/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'

interface ErrorDetailDialogProps {
  open: boolean
  onClose: () => void
  errorMessage: string
}

export const ErrorDetailDialog: React.FC<ErrorDetailDialogProps> = ({
  open,
  onClose,
  errorMessage,
}) => {
  const { t } = useTranslation()
  const addToast = useUiStore(state => state.addToast)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    void navigator.clipboard.writeText(errorMessage).then(() => {
      setCopied(true)
      addToast({ type: TOAST_TYPE.SUCCESS, message: t('transfer.errorDetail.copied') })
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <GlassDialog open={open} onClose={onClose} width={500} height={360}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">{t('transfer.errorDetail.title')}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text hover:bg-hover transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto rounded-lg bg-hover p-3 mb-4">
          <pre className="text-sm text-text font-mono whitespace-pre-wrap break-all m-0">
            {errorMessage}
          </pre>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            {copied ? t('transfer.errorDetail.copied') : t('transfer.errorDetail.copy')}
          </button>
        </div>
      </div>
    </GlassDialog>
  )
}
