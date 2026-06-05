import type React from 'react'
import { useTranslation } from 'react-i18next'
import { ROOT_PATH } from '@shared/constants/index.js'

interface ParentDirectoryButtonProps {
  currentPath: string
  onNavigate: () => void
}

export const ParentDirectoryButton: React.FC<ParentDirectoryButtonProps> = ({
  currentPath,
  onNavigate,
}) => {
  const { t } = useTranslation()

  if (currentPath === ROOT_PATH) {
    return null
  }

  return (
    <div className="flex items-center justify-center py-2.5 border-t border-border">
      <button
        onClick={onNavigate}
        className={`
          px-3.5 py-1.5 rounded bg-transparent border border-border
          cursor-pointer text-xs text-text flex items-center gap-1.5
          hover:bg-hover transition-colors
          focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
        `}
      >
        <svg className="w-3.5 h-3.5 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {t('fileExplorerList.parentDirectory')}
      </button>
    </div>
  )
}

export default ParentDirectoryButton
