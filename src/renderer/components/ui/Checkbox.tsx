import { Check } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'

import { cn } from '../../utils/index.js'

interface CheckboxProps {
  checked: boolean
  onChange?: (checked: boolean) => void
  label?: string
  disabled?: boolean
  id?: string
  className?: string
  /** 没有可见文字时用它提供无障碍名（如权限矩阵里的单元格） */
  'aria-label'?: string
}

export const Checkbox = ({
  checked,
  onChange,
  label,
  disabled,
  id,
  className,
  'aria-label': ariaLabel,
}: CheckboxProps) => {
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
      aria-label={ariaLabel}
      className={cn(
        // 只保留「边框 + 填充 + 对勾」，不加光晕与背景块。
        // 描边取 text-muted/70：input-border 在暗色卡片上几乎不可见。
        'size-4 shrink-0 rounded-[3px] border flex items-center justify-center',
        'transition-colors duration-150',
        'border-text-muted/70 bg-transparent',
        'data-[state=checked]:bg-accent data-[state=checked]:border-accent',
        'data-[state=unchecked]:hover:border-text-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        disabled ? 'cursor-not-allowed' : 'cursor-default',
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
      <label className={cn('flex items-center gap-2', disabled && 'opacity-50 cursor-not-allowed')}>
        {root}
        <span className="text-xs">{label}</span>
      </label>
    )
  }

  return root
}

export default Checkbox
