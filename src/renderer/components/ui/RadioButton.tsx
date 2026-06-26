import type React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'

import { cn } from '@renderer/utils/index.js'

interface RadioGroupProps {
  value: string
  onValueChange: (value: string) => void
  className?: string
  children: React.ReactNode
}

export const RadioGroup = ({ value, onValueChange, className, children }: RadioGroupProps) => {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      className={cn('flex', className)}
    >
      {children}
    </RadioGroupPrimitive.Root>
  )
}

interface RadioButtonProps {
  value: string
  label: string
  labelClassName?: string
  disabled?: boolean
  className?: string
}

export const RadioButton = ({
  value,
  label,
  labelClassName = 'text-text',
  disabled,
  className,
}: RadioButtonProps) => {
  return (
    <label
      className={cn(
        'flex items-center gap-2 cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <RadioGroupPrimitive.Item
        value={value}
        disabled={disabled}
        className={cn(
          'relative size-4 rounded-full border-2 transition-all duration-200',
          'border-input-border bg-transparent hover:border-input-border-hover',
          'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
          'data-[state=checked]:shadow-[0_0_0_3px_var(--color-accent-light)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          className,
        )}
      >
        <RadioGroupPrimitive.Indicator className="absolute inset-0 flex items-center justify-center">
          <span className="size-1.5 rounded-full bg-white" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
      <span className={cn('text-xs', labelClassName)}>{label}</span>
    </label>
  )
}

export default RadioButton
