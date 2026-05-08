import React from 'react'
import { useTranslation } from 'react-i18next'

interface ParentDirectoryButtonProps {
  currentPath: string
  onNavigate: () => void
}

export const ParentDirectoryButton: React.FC<ParentDirectoryButtonProps> = ({
  currentPath,
  onNavigate,
}) => {
  const { t } = useTranslation()

  if (currentPath === '/') {
    return null
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px',
        borderTop: '1px solid var(--border)',
      }}
    >
      <button
        onClick={onNavigate}
        style={{
          padding: '6px 14px',
          borderRadius: '4px',
          backgroundColor: 'transparent',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          fontSize: '12px',
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {t('fileList.parentDirectory')}
      </button>
    </div>
  )
}

export default ParentDirectoryButton
