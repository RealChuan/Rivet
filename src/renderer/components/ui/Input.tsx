import React from 'react'

interface InputProps {
  as?: 'input' | 'textarea'
  className?: string
  [key: string]: any
}

export const Input: React.FC<InputProps> = ({ className = '', as = 'input', ...props }) => {
  const baseClass = `
    w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-md 
    text-[var(--text)] text-[13px] transition-colors duration-150 
    placeholder:text-[var(--text-muted)] hover:border-[var(--text-muted)] 
    focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] 
    box-border min-h-[33px]
  `
    .trim()
    .replace(/\s+/g, ' ')

  if (as === 'textarea') {
    return <textarea className={`${baseClass} ${className}`} {...props} />
  }

  return <input className={`${baseClass} ${className}`} {...props} />
}

export default Input
