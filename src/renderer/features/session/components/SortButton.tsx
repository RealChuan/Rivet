import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  SORT_ORDER_NONE,
  SORT_ORDER_ASC,
  SORT_ORDER_DESC,
  type SortOrder,
} from '@shared/constants/sort.js'

interface SortButtonProps {
  sortOrder: SortOrder
  onClick: () => void
}

export const SortButton: React.FC<SortButtonProps> = ({ sortOrder, onClick }) => {
  const { t } = useTranslation()

  return (
    <button
      onClick={onClick}
      className={`
        p-1.5 rounded-md flex items-center justify-center
        border-none cursor-pointer transition-all duration-150
        hover:bg-hover
        ${sortOrder !== SORT_ORDER_NONE ? 'text-accent' : 'text-text-muted'}
      `}
      title={t('sortButton.sortConnections')}
    >
      <svg className="w-4 h-4 stroke-current" viewBox="0 0 24 24" fill="none">
        {sortOrder === SORT_ORDER_ASC ? (
          <polyline points="18 9 12 3 6 9" strokeWidth={2} />
        ) : sortOrder === SORT_ORDER_DESC ? (
          <polyline points="6 15 12 21 18 15" strokeWidth={2} />
        ) : (
          <>
            <polyline points="18 9 12 3 6 9" strokeWidth={1.5} />
            <polyline points="6 15 12 21 18 15" strokeWidth={1.5} />
          </>
        )}
      </svg>
    </button>
  )
}

export default SortButton
