import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../../../components/ui/index.js'

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

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <IconButton
        onClick={onBack}
        disabled={!canGoBack}
        size="lg"
        label={`${t(($) => $.fileExplorerList.back)} (Alt+←)`}
        ariaLabel={t(($) => $.fileExplorerList.back)}
        testId="navigate-back"
      >
        <ArrowLeft className="w-4 h-4 stroke-current stroke-2" />
      </IconButton>
      <IconButton
        onClick={onForward}
        disabled={!canGoForward}
        size="lg"
        label={`${t(($) => $.fileExplorerList.forward)} (Alt+→)`}
        ariaLabel={t(($) => $.fileExplorerList.forward)}
        testId="navigate-forward"
      >
        <ArrowRight className="w-4 h-4 stroke-current stroke-2" />
      </IconButton>
    </div>
  )
}

export default FileExplorerNavigation
