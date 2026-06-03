import type React from 'react'

interface RetryIconProps {
  className?: string
}

export const RetryIcon: React.FC<RetryIconProps> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10V4" />
  </svg>
)

export default RetryIcon
