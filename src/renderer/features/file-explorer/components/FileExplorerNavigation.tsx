import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../utils/index.js'

interface FileExplorerNavigationProps {
  canGoBack: boolean
  canGoForward: boolean
  onBack: () => void
  onForward: () => void
}

export const FileExplorerNavigation = ({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: FileExplorerNavigationProps) => {
  const { t } = useTranslation()

  const buttonClass = (enabled: boolean) =>
    cn(
      'w-8 h-8 rounded-md flex items-center justify-center border-none bg-transparent',
      'transition-colors duration-150',
      'focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2',
      enabled
        ? 'text-text-muted hover:text-text hover:bg-hover'
        : 'text-text-muted opacity-35 cursor-default',
    )

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack}
        title={`${t(($) => $.fileExplorerList.back)} (Alt+←)`}
        aria-label={t(($) => $.fileExplorerList.back)}
        data-testid="navigate-back"
        className={buttonClass(canGoBack)}
      >
        <ArrowLeft className="w-4 h-4 stroke-current stroke-2" />
      </button>
      <button
        type="button"
        onClick={onForward}
        disabled={!canGoForward}
        title={`${t(($) => $.fileExplorerList.forward)} (Alt+→)`}
        aria-label={t(($) => $.fileExplorerList.forward)}
        data-testid="navigate-forward"
        className={buttonClass(canGoForward)}
      >
        <ArrowRight className="w-4 h-4 stroke-current stroke-2" />
      </button>
    </div>
  )
}

export default FileExplorerNavigation
