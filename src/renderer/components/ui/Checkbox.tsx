import type React from 'react'

import { Check } from 'lucide-react'
import { cn } from '@renderer/utils/index.js'

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  onChange,
  disabled,
  className = '',
  id,
  ...props
}) => {
  return (
    <label
      className={cn(
        'flex items-center gap-2 cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      htmlFor={id}
    >
      <span className="relative flex items-center justify-center size-4">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <span
          className={cn(
            'size-4 rounded-[3px] border-2 flex items-center justify-center',
            'transition-all duration-200 cursor-pointer',
            'peer-checked:bg-accent peer-checked:border-accent',
            'peer-checked:shadow-[0_0_0_3px_var(--color-accent-light)]',
            'border-input-border bg-transparent',
            'hover:border-input-border-hover',
            disabled && 'cursor-not-allowed'
          )}
        >
          {checked && <Check className="w-2.5 h-2.5 stroke-white stroke-3" />}
        </span>
      </span>
      {label && <span className="text-xs">{label}</span>}
    </label>
  )
}

export default Checkbox
