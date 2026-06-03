import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SORT_ORDER, type SortOrderWithDirection } from '@shared/constants/sort.js'
import { type TransferSortField, TRANSFER_SORT_FIELD } from '@shared/constants/transfer.js'

const SORT_FIELDS: TransferSortField[] = [
  TRANSFER_SORT_FIELD.CREATED_AT,
  TRANSFER_SORT_FIELD.NAME,
  TRANSFER_SORT_FIELD.STATUS,
  TRANSFER_SORT_FIELD.REMAINING_TIME,
]

interface SortDropdownProps {
  sortBy: TransferSortField | undefined
  sortOrder: SortOrderWithDirection
  onSort: (field: TransferSortField) => void
}

export const SortDropdown: React.FC<SortDropdownProps> = ({ sortBy, sortOrder, onSort }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

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
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="16" y2="12" />
          <line x1="4" y1="18" x2="12" y2="18" />
        </svg>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-50 p-3 rounded-lg border border-border bg-bg shadow-lg">
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
                  {t('sort.asc')}
                </button>
                <button
                  type="button"
                  className={`
                    flex-1 px-3 py-1.5 rounded-md text-xs border cursor-default transition-colors
                    ${isActive(field, SORT_ORDER.DESC) ? 'border-accent text-accent bg-accent/5' : 'border-border text-text bg-transparent hover:bg-hover'}
                  `}
                  onClick={() => {
                    onSort(field)
                    setOpen(false)
                  }}
                >
                  {t('sort.desc')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
