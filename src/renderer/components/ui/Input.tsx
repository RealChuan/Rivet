import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  as?: 'input' | 'textarea'
}

export const Input: React.FC<InputProps> = ({ className = '', as = 'input', ...props }) => {
  const baseClassName = `
    w-full px-3 py-2 bg-bg border border-border rounded-md
    text-text text-[13px] transition-colors duration-150
    placeholder:text-text-muted hover:border-text-muted
    focus:outline-none focus:ring-2 focus:ring-focus-ring
    box-border
  `

  if (as === 'textarea') {
    return <textarea className={`${baseClassName} ${className}`} {...props} />
  }

  return <input className={`${baseClassName} min-h-8.25 ${className}`} {...props} />
}

export default Input
