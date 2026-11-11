import { ClipboardPaste, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '../../../components/ui/Button.js'

interface SidebarHeaderProps {
  onNewConnection: () => void
  onPasteAddress: () => void
}

export const SidebarHeader = ({ onNewConnection, onPasteAddress }: SidebarHeaderProps) => {
  const { t } = useTranslation()

  return (
    <div className="p-4 border-b border-border">
      <Button
        variant="primary"
        className="w-full justify-center"
        data-testid="connection-new"
        onClick={onNewConnection}
      >
        <Plus className="w-3.5 h-3.5" />
        {t(($) => $.connection.newConnection)}
      </Button>
      <button
        data-testid="connection-paste-address"
        onClick={onPasteAddress}
        className={`
          mt-2 w-full px-3 py-1.5 rounded-md border border-border bg-transparent
          text-xs text-text-muted flex items-center justify-center gap-1.5
          transition-colors hover:text-text hover:border-accent
          focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
        `}
      >
        <ClipboardPaste className="w-3.5 h-3.5" />
        {t(($) => $.connection.pasteAddress)}
      </button>
    </div>
  )
}

export default SidebarHeader
