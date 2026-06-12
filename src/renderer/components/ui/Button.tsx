import type React from 'react'

import { LoaderIcon } from '@renderer/components/common/index.js'
import { cn } from '@renderer/utils/index.js'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning'
  isLoading?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  isLoading = false,
  className = '',
  children,
  disabled,
  ...props
}) => {
  const baseClasses = `
    px-4 py-2 rounded-md text-sm font-medium
    transition-all duration-150 active:scale-[0.97]
    flex items-center gap-1.5
    cursor-pointer
  `

  const variantClasses = {
    primary: `
      bg-accent text-white border-none
      hover:bg-accent-hover
      disabled:bg-disabled disabled:cursor-not-allowed
    `,
    secondary: `
      bg-transparent text-text border border-input-border
      hover:bg-hover hover:border-input-border-hover hover:shadow-sm
    `,
    danger: `
      bg-danger text-white border-none
      hover:bg-danger/90 hover:shadow-[0_2px_8px_var(--color-danger-light)]
      disabled:bg-disabled disabled:cursor-not-allowed disabled:shadow-none
    `,
    warning: `
      bg-warning text-white border-none
      hover:bg-warning/90 hover:shadow-[0_2px_8px_var(--color-warning-light)]
      disabled:bg-disabled disabled:cursor-not-allowed disabled:shadow-none
    `,
  }

  const classes = cn(baseClasses, variantClasses[variant], className)

  return (
    <button className={classes} disabled={isLoading || disabled} {...props}>
      {isLoading ? (
        <>
          <LoaderIcon className="w-3.5 h-3.5 stroke-current stroke-3" />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  )
}

export default Button
