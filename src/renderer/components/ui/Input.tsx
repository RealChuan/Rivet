import type React from 'react'

import { cn } from '@renderer/utils/index.js'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  as?: 'input' | 'textarea'
}

const baseClassName = `
  w-full px-3 py-2 bg-glass-bg border border-border rounded-md
  text-text text-[13px] transition-colors duration-150
  placeholder:text-text-muted hover:border-text-muted
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-accent
  box-border
`

export const Input = ({ className, as = 'input', ...props }: InputProps) => {
  if (as === 'textarea') {
    return <textarea className={cn(baseClassName, className)} {...props} />
  }

  return <input className={cn(baseClassName, 'min-h-8.25', className)} {...props} />
}

export default Input
