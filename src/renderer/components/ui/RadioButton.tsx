import type React from 'react'

import { cn } from '@renderer/utils/index.js'

interface RadioButtonProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  labelClassName?: string
}

export const RadioButton: React.FC<RadioButtonProps> = ({
  label,
  labelClassName = 'text-text',
  checked,
  onChange,
  name,
  disabled,
  ...props
}) => {
  return (
    <label
      className={cn(
        'flex items-center gap-2 cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        labelClassName
      )}
    >
      <span className="relative flex items-center justify-center size-4">
        <input
          type="radio"
          name={name}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
          {...props}
        />
        <span
          className={cn(
            'size-4 rounded-full border-2 transition-all duration-200',
            checked
              ? 'border-accent bg-accent shadow-[0_0_0_3px_var(--color-accent-light)]'
              : 'border-input-border bg-transparent hover:border-input-border-hover'
          )}
        >
          {checked && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="size-1.5 rounded-full bg-white" />
            </span>
          )}
        </span>
      </span>
      <span className="text-xs">{label}</span>
    </label>
  )
}

export default RadioButton
