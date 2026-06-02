import type React from 'react'
import { useTranslation } from 'react-i18next'
import { type SortOrderWithDirection } from '@shared/constants/sort.js'
import { type TransferSortField } from '@shared/constants/transfer.js'
import { SortDropdown } from './SortDropdown.js'

interface TransferActionBarProps {
  sortBy: TransferSortField | undefined
  sortOrder: SortOrderWithDirection
  onSort: (field: TransferSortField) => void
  onCancelAll: () => void
}

export const TransferActionBar: React.FC<TransferActionBarProps> = ({
  sortBy,
  sortOrder,
  onSort,
  onCancelAll,
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
      <button
        type="button"
        onClick={onCancelAll}
        className="px-3 py-1.5 rounded-md text-xs text-danger border border-danger/30 bg-danger/10 hover:bg-danger/20 transition-colors cursor-default"
        aria-label={t('transfer.action.cancelAll')}
      >
        {t('transfer.action.cancelAll')}
      </button>
      <div className="flex-1" />
      <SortDropdown sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
    </div>
  )
}
