import type React from 'react'
import { useTranslation } from 'react-i18next'

const SKELETON_WIDTHS = [92, 88, 95, 85, 90, 87, 93, 86]

export const FileExplorerListLoading: React.FC = () => {
  return (
    <div className="h-full p-4 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          className="h-8 rounded-md animate-skeleton-shimmer"
          style={{
            width: `${SKELETON_WIDTHS[i]}%`,
            background: `linear-gradient(90deg, var(--color-hover) 25%, var(--color-subtle-hover) 37%, var(--color-hover) 63%)`,
            backgroundSize: '200% 100%',
          }}
        />
      ))}
    </div>
  )
}

interface FileExplorerListErrorProps {
  error: string
  onRetry: () => void
}
export const FileExplorerListError: React.FC<FileExplorerListErrorProps> = ({ error, onRetry }) => {
  const { t } = useTranslation()

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 gap-4">
      <div className="w-10 h-10 rounded-lg bg-danger-light flex items-center justify-center">
        <svg className="w-5 h-5 stroke-danger stroke-2" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-sm font-medium text-text mb-1">{t('fileExplorerList.error')}</h3>
        <p className="text-xs text-danger">{error}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-md bg-accent text-white text-xs font-medium border-none cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
      >
        <svg className="w-3.5 h-3.5 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
        </svg>
        {t('fileExplorerList.retry')}
      </button>
    </div>
  )
}

export const FileExplorerListEmpty: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="h-full flex flex-col items-center justify-center gap-2">
      <div className="w-10 h-10 rounded-lg bg-hover flex items-center justify-center">
        <svg className="w-4 h-4 stroke-text-muted stroke-[1.5]" viewBox="0 0 24 24" fill="none">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
      </div>
      <p className="text-xs text-text-muted">{t('fileExplorerList.empty')}</p>
    </div>
  )
}
