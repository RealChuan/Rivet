import type React from 'react'

interface FileIconProps {
  type: 'file' | 'directory'
  className?: string
}

export const FileIcon: React.FC<FileIconProps> = ({ type, className = '' }) => {
  const baseClasses = `w-4 h-4 ${className}`

  if (type === 'directory') {
    return (
      <svg className={baseClasses} viewBox="0 0 24 24" stroke="none" fill="var(--color-warning)">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
    )
  }

  return (
    <svg
      className={baseClasses}
      viewBox="0 0 24 24"
      fill="var(--color-accent-light)"
      stroke="var(--color-accent)"
      strokeWidth="1.5"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

export default FileIcon
