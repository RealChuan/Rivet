import * as SelectPrimitive from '@radix-ui/react-select'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@renderer/utils/index.js'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
}

export const Select = ({ value, onChange, options, className }: SelectProps) => {
  const { t } = useTranslation()

  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger
        className={cn(
          'w-full px-3 pr-8 py-2 bg-glass-bg border border-border rounded-md',
          'text-text text-left flex items-center justify-between relative cursor-pointer',
          'transition-colors duration-150 hover:border-text-muted focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring text-[13px] box-border min-h-8.25 m-0',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={t(($) => $.common.selectPlaceholder)} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-150 group-data-[state=open]:rotate-180" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={1}
          className={cn(
            'bg-glass-bg backdrop-blur-xl border border-border rounded-md shadow-dropdown',
            'list-none p-1 box-border z-100',
          )}
          style={{ width: 'var(--radix-select-trigger-width)' }}
        >
          <SelectPrimitive.Viewport className="max-h-50 overflow-y-auto">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className={cn(
                  'px-3 py-2 cursor-pointer transition-colors duration-100',
                  'text-text data-highlighted:bg-hover data-[state=checked]:text-accent data-[state=checked]:font-medium',
                  'outline-none',
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export default Select
