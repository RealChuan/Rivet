import { AlertCircle, RotateCcw, Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const SKELETON_WIDTHS = [92, 88, 95, 85, 90, 87, 93, 86]

export const FileExplorerListLoading = () => {
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
export const FileExplorerListError = ({ error, onRetry }: FileExplorerListErrorProps) => {
  const { t } = useTranslation()

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 gap-4">
      <div className="w-10 h-10 rounded-lg bg-danger-light flex items-center justify-center">
        <AlertCircle className="w-5 h-5 stroke-danger stroke-2" />
      </div>
      <div className="text-center">
        <h3 className="text-sm font-medium text-text mb-1">{t(($) => $.fileExplorerList.error)}</h3>
        <p className="text-xs text-danger">{error}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-md bg-accent text-white text-xs font-medium border-none cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
      >
        <RotateCcw className="w-3.5 h-3.5 stroke-current stroke-2" />
        {t(($) => $.fileExplorerList.retry)}
      </button>
    </div>
  )
}

export const FileExplorerListEmpty = () => {
  const { t } = useTranslation()

  return (
    <div className="h-full flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-hover border border-border flex items-center justify-center">
        <Folder className="w-5 h-5 stroke-text-muted stroke-[1.5]" />
      </div>
      <p className="text-xs text-text-muted">{t(($) => $.fileExplorerList.empty)}</p>
    </div>
  )
}
