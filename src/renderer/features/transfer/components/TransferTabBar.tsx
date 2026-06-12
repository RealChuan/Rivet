import type React from 'react'
import { useTranslation } from 'react-i18next'
import type { TransferDirection } from '@shared/constants/transfer.js'
import { TRANSFER_DIRECTION } from '@shared/constants/transfer.js'

interface TransferTabBarProps {
  activeTab: TransferDirection
  onTabChange: (tab: TransferDirection) => void
}

export const TransferTabBar: React.FC<TransferTabBarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation()

  return (
    <div className="flex gap-6 border-b border-border shrink-0 px-4 pt-3.5 pb-0">
      <button
        type="button"
        className={`px-3 py-2 text-sm font-medium border-b-2 bg-transparent cursor-default transition-colors ${
          activeTab === TRANSFER_DIRECTION.UPLOAD
            ? 'text-accent border-accent'
            : 'text-text-muted border-transparent hover:text-text'
        }`}
        aria-label={t('transfer.upload')}
        title={t('transfer.upload')}
        onClick={() => onTabChange(TRANSFER_DIRECTION.UPLOAD)}
      >
        {t('transfer.upload')}
      </button>
      <button
        type="button"
        className={`px-3 py-2 text-sm font-medium border-b-2 bg-transparent cursor-default transition-colors ${
          activeTab === TRANSFER_DIRECTION.DOWNLOAD
            ? 'text-accent border-accent'
            : 'text-text-muted border-transparent hover:text-text'
        }`}
        aria-label={t('transfer.download')}
        title={t('transfer.download')}
        onClick={() => onTabChange(TRANSFER_DIRECTION.DOWNLOAD)}
      >
        {t('transfer.download')}
      </button>
    </div>
  )
}
