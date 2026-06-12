import type React from 'react'
import { ChevronDown, ListFilter } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClickOutside } from '@renderer/hooks/index.js'
import { cn } from '@renderer/utils/index.js'
import { SORT_ORDER, type SortOrderWithDirection } from '@shared/constants/sort.js'
import { type TransferSortField, TRANSFER_SORT_FIELD } from '@shared/constants/transfer.js'

const SORT_FIELDS: TransferSortField[] = [
  TRANSFER_SORT_FIELD.CREATED_AT,
  TRANSFER_SORT_FIELD.NAME,
  TRANSFER_SORT_FIELD.STATUS,
  TRANSFER_SORT_FIELD.REMAINING_TIME,
]

interface SortDropdownProps {
  sortBy: TransferSortField
  sortOrder: SortOrderWithDirection
  onSort: (field: TransferSortField) => void
}

export const SortDropdown: React.FC<SortDropdownProps> = ({ sortBy, sortOrder, onSort }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside({
    ref,
    enabled: open,
    includeEscape: false,
    onOutside: () => setOpen(false),
  })

  const getFieldLabel = (field: TransferSortField) => {
    switch (field) {
      case TRANSFER_SORT_FIELD.CREATED_AT:
        return t('transfer.sort.time')
      case TRANSFER_SORT_FIELD.NAME:
        return t('transfer.sort.name')
      case TRANSFER_SORT_FIELD.STATUS:
        return t('transfer.sort.status')
      case TRANSFER_SORT_FIELD.REMAINING_TIME:
        return t('transfer.sort.size')
    }
  }

  const isActive = (field: TransferSortField, order: SortOrderWithDirection) =>
    sortBy === field && sortOrder === order

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-text-muted hover:text-text border border-border bg-bg hover:bg-hover transition-colors cursor-default"
        aria-label={t('transfer.action.sort')}
      >
        <ListFilter className="w-3.5 h-3.5" />
        <ChevronDown className="w-2.5 h-2.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-50 p-3 rounded-lg border border-border bg-bg shadow-dropdown">
          {SORT_FIELDS.map(field => (
            <div key={field} className="mb-3 last:mb-0">
              <div className="text-xs text-text-muted mb-1.5">{getFieldLabel(field)}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`
                    flex-1 px-3 py-1.5 rounded-md text-xs border cursor-default transition-colors
                    ${isActive(field, SORT_ORDER.ASC) ? 'border-accent text-accent bg-accent-light' : 'border-border text-text bg-transparent hover:bg-hover'}
                  `}
                  onClick={() => {
                    onSort(field)
                    setOpen(false)
                  }}
                >
                  {t('common.sort.asc')}
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-md text-xs border cursor-default transition-colors',
                    isActive(field, SORT_ORDER.DESC)
                      ? 'border-accent text-accent bg-accent-light'
                      : 'border-border text-text bg-transparent hover:bg-hover'
                  )}
                  onClick={() => {
                    onSort(field)
                    setOpen(false)
                  }}
                >
                  {t('common.sort.desc')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
