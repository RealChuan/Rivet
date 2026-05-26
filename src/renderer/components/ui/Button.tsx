import React from 'react'

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
    border transition-colors duration-150
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
      bg-transparent text-text border border-border
      hover:bg-hover hover:border-text-muted
      dark:border-border dark:hover:border-text-muted
    `,
    danger: `
      bg-danger text-white border-none
      hover:bg-danger/90
      disabled:bg-disabled disabled:cursor-not-allowed
    `,
    warning: `
      bg-warning text-white border-none
      hover:bg-warning/90
      disabled:bg-disabled disabled:cursor-not-allowed
    `,
  }

  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`.trim()

  return (
    <button className={classes} disabled={isLoading || disabled} {...props}>
      {isLoading ? (
        <>
          <svg
            className="w-3.5 h-3.5 stroke-current stroke-3 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" className="opacity-25" />
            <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
          </svg>
          {children}
        </>
      ) : (
        children
      )}
    </button>
  )
}

export default Button
