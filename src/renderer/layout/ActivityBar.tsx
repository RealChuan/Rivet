import type React from 'react'
import { useTranslation } from 'react-i18next'
import { SIDEBAR_VIEW, type SidebarView } from '@shared/constants/transfer.js'

interface ActivityBarButtonProps {
  icon: React.ReactNode
  isActive: boolean
  label: string
  onClick: () => void
}

const ActivityBarButton = ({ icon, isActive, label, onClick }: ActivityBarButtonProps) => {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`
        relative w-full h-12 flex items-center justify-center
        transition-colors
        focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
        ${isActive ? 'text-text bg-accent/5' : 'text-text-muted/60 hover:text-text hover:bg-hover'}
      `}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-full bg-accent" />
      )}
      {icon}
    </button>
  )
}

const ConnectionIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
)

const TransferIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

interface ActivityBarProps {
  activeView: SidebarView
  onViewChange: (view: SidebarView) => void
}

export const ActivityBar: React.FC<ActivityBarProps> = ({ activeView, onViewChange }) => {
  const { t } = useTranslation()

  return (
    <nav className="w-12 shrink-0 flex flex-col items-center bg-bg border-r border-border pt-1">
      <ActivityBarButton
        icon={<ConnectionIcon />}
        isActive={activeView === SIDEBAR_VIEW.CONNECTIONS}
        label={t('activityBar.connections')}
        onClick={() => onViewChange(SIDEBAR_VIEW.CONNECTIONS)}
      />
      <ActivityBarButton
        icon={<TransferIcon />}
        isActive={activeView === SIDEBAR_VIEW.TRANSFERS}
        label={t('activityBar.transfers')}
        onClick={() => onViewChange(SIDEBAR_VIEW.TRANSFERS)}
      />
    </nav>
  )
}
