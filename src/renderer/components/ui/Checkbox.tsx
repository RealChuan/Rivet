import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'

import { cn } from '@renderer/utils/index.js'

interface CheckboxProps {
  checked: boolean
  onChange?: (checked: boolean) => void
  label?: string
  disabled?: boolean
  id?: string
  className?: string
}

export const Checkbox = ({ checked, onChange, label, disabled, id, className }: CheckboxProps) => {
  const handleCheckedChange = (value: boolean | 'indeterminate') => {
    if (onChange && value !== 'indeterminate') {
      onChange(value)
    }
  }

  const root = (
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={handleCheckedChange}
      disabled={disabled}
      className={cn(
        'size-4 rounded-[3px] border-2 flex items-center justify-center',
        'transition-all duration-200 cursor-pointer',
        'data-[state=checked]:bg-accent data-[state=checked]:border-accent',
        'data-[state=checked]:shadow-[0_0_0_3px_var(--color-accent-light)]',
        'border-input-border bg-transparent',
        'hover:border-input-border-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        disabled && 'cursor-not-allowed',
        !label && disabled && 'opacity-50',
        className,
      )}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="w-2.5 h-2.5 stroke-white stroke-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )

  if (label) {
    return (
      <label
        className={cn(
          'flex items-center gap-2',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        {root}
        <span className="text-xs">{label}</span>
      </label>
    )
  }

  return root
}

export default Checkbox
