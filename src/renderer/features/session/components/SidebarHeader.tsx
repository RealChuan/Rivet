import type React from 'react'
import { useTranslation } from 'react-i18next'

interface SidebarHeaderProps {
  onNewConnection: () => void
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onNewConnection }) => {
  const { t } = useTranslation()

  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center gap-2.5 mb-3.5">
        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-accent">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-text">{t('app.name')}</h1>
          <p className="text-xs text-text-muted">{t('app.subtitle')}</p>
        </div>
      </div>
      <button
        onClick={onNewConnection}
        className={`
          w-full px-3 py-2 rounded-md bg-accent text-white
          text-sm font-medium flex items-center justify-center gap-1.5
          transition-colors border-none cursor-pointer hover:bg-accent-hover
          focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
        `}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {t('connection.newConnection')}
      </button>
    </div>
  )
}

export default SidebarHeader
