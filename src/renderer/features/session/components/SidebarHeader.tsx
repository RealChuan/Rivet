import type React from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SidebarHeaderProps {
  onNewConnection: () => void
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onNewConnection }) => {
  const { t } = useTranslation()

  return (
    <div className="p-4 border-b border-border">
      <button
        onClick={onNewConnection}
        className={`
          w-full px-3 py-2 rounded-md bg-accent text-white
          text-sm font-medium flex items-center justify-center gap-1.5
          transition-colors border-none cursor-pointer hover:bg-accent-hover
          focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
        `}
      >
        <Plus className="w-3.5 h-3.5" />
        {t('connection.newConnection')}
      </button>
    </div>
  )
}

export default SidebarHeader
