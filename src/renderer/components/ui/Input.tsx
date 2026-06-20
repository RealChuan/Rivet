import type React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  as?: 'input' | 'textarea'
}

export const Input = ({ className = '', as = 'input', ...props }: InputProps) => {
  const baseClassName = `
    w-full px-3 py-2 bg-glass-bg border border-border rounded-md
    text-text text-[13px] transition-colors duration-150
    placeholder:text-text-muted hover:border-text-muted
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-accent
    box-border
  `

  if (as === 'textarea') {
    return <textarea className={`${baseClassName} ${className}`} {...props} />
  }

  return <input className={`${baseClassName} min-h-8.25 ${className}`} {...props} />
}

export default Input
