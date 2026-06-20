import type React from 'react'
import { Server, ArrowLeftRight } from 'lucide-react'
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
        ${isActive ? 'text-text bg-accent-light' : 'text-text-muted hover:text-text hover:bg-hover'}
      `}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-full bg-accent" />
      )}
      {icon}
    </button>
  )
}

interface ActivityBarProps {
  activeView: SidebarView
  onViewChange: (view: SidebarView) => void
}

export const ActivityBar = ({ activeView, onViewChange }: ActivityBarProps) => {
  const { t } = useTranslation()

  return (
    <nav className="w-12 shrink-0 flex flex-col items-center bg-transparent border-r border-border pt-1">
      <ActivityBarButton
        icon={<Server className="w-5.5 h-5.5 stroke-[1.5]" />}
        isActive={activeView === SIDEBAR_VIEW.CONNECTIONS}
        label={t(($) => $.activityBar.connections)}
        onClick={() => onViewChange(SIDEBAR_VIEW.CONNECTIONS)}
      />
      <ActivityBarButton
        icon={<ArrowLeftRight className="w-5.5 h-5.5 stroke-[1.5]" />}
        isActive={activeView === SIDEBAR_VIEW.TRANSFERS}
        label={t(($) => $.activityBar.transfers)}
        onClick={() => onViewChange(SIDEBAR_VIEW.TRANSFERS)}
      />
    </nav>
  )
}
