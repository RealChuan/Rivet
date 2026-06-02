import type React from 'react'
import { useTranslation } from 'react-i18next'

export const TransferTabBar: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="flex border-b border-border shrink-0">
      <button
        type="button"
        className="px-4 py-2 text-sm font-medium text-accent border-b-2 border-accent bg-transparent cursor-default"
        aria-label={t('transfer.upload')}
      >
        {t('transfer.upload')}
      </button>
      <button
        type="button"
        className="px-4 py-2 text-sm text-text-muted cursor-not-allowed opacity-50 bg-transparent border-b-2 border-transparent"
        disabled
        title={t('transfer.downloadDisabled')}
        aria-label={t('transfer.download')}
      >
        {t('transfer.download')}
      </button>
    </div>
  )
}
