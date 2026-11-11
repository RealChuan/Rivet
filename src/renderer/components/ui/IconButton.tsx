import type React from 'react'

import { cn } from '../../utils/index.js'

export type IconButtonSize = 'sm' | 'md' | 'lg'

/** 尺寸对齐现有各处：工具栏 28、导航 32、传输面板 24 */
const SIZE_CLASS: Record<IconButtonSize, string> = {
  sm: 'w-6 h-6',
  md: 'w-7 h-7',
  lg: 'w-8 h-8',
}

export type IconButtonVariant = 'default' | 'danger' | 'close'

const VARIANT_CLASS: Record<IconButtonVariant, string> = {
  default: 'text-text-muted hover:bg-hover hover:text-text',
  /** 破坏性动作：浅红底 + 红图标，如取消传输、移除收藏 */
  danger: 'text-text-muted hover:bg-danger-light hover:text-danger',
  /** 关闭类：hover 与主窗口关闭按钮一致，红底白图标 */
  close: 'text-text-muted hover:bg-danger hover:text-white',
}

interface IconButtonProps {
  onClick: () => void
  /** tooltip 文案，同时作为缺省的无障碍名 */
  label: string
  /** 覆盖读屏名，需要比 tooltip 更简洁时使用 */
  ariaLabel?: string
  size?: IconButtonSize
  variant?: IconButtonVariant
  isActive?: boolean
  disabled?: boolean
  testId?: string
  className?: string
  children: React.ReactNode
}

export const IconButton = ({
  onClick,
  label,
  ariaLabel,
  size = 'md',
  variant = 'default',
  isActive,
  disabled,
  testId,
  className,
  children,
}: IconButtonProps) => (
  <button
    type="button"
    {...(testId ? { 'data-testid': testId } : {})}
    {...(isActive === undefined ? {} : { 'aria-pressed': isActive })}
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={ariaLabel ?? label}
    className={cn(
      'flex items-center justify-center shrink-0 rounded-md border-none bg-transparent',
      'transition-colors duration-150',
      'focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2',
      SIZE_CLASS[size],
      disabled
        ? 'text-text-muted opacity-35 cursor-default'
        : isActive
          ? 'bg-accent-light text-accent'
          : VARIANT_CLASS[variant],
      className,
    )}
  >
    {children}
  </button>
)

export default IconButton
