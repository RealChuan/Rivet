import React from 'react'
import { useTranslation } from 'react-i18next'

export const FileListLoading: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex items-center gap-2.5">
        <svg className="w-4 h-4 text-accent animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            className="opacity-25"
          />
          <path
            d="M12 2a10 10 0 0110 10"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <span className="text-xs text-text-muted">{t('fileList.loading')}</span>
      </div>
    </div>
  )
}

export const FileListError: React.FC<{ error: string; onRetry: () => void }> = ({
  error,
  onRetry,
}) => {
  const { t } = useTranslation()

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 gap-4">
      <div className="w-12 h-12 rounded-full bg-[rgba(241,76,76,0.1)] flex items-center justify-center">
        <svg className="w-5 h-5 stroke-danger stroke-2" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-sm font-medium text-text mb-1">Error</h3>
        <p className="text-xs text-danger">{error}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-md bg-accent text-white text-xs font-medium border-none cursor-pointer flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
        </svg>
        {t('fileList.retry')}
      </button>
    </div>
  )
}

export const FileListEmpty: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="h-full flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-full bg-hover flex items-center justify-center">
        <svg className="w-5 h-5 stroke-text-muted stroke-[1.5]" viewBox="0 0 24 24" fill="none">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
      </div>
      <p className="text-xs text-text-muted">{t('fileList.empty')}</p>
    </div>
  )
}
