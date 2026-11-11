import type React from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '../../utils/index.js'
import { IconButton } from './IconButton.js'

interface DialogHeaderProps {
  /** 标题左侧的图标方块；不传则不渲染 */
  icon?: React.ReactNode
  /** 图标方块的底色，如 `bg-accent/10` */
  iconClassName?: string
  title: string
  subtitle?: string
  /** 副标题被截断时展示的完整内容，默认用副标题本身 */
  subtitleTitle?: string
  onClose?: () => void
}

/** 对话框头部：图标方块 + 标题 + 副标题 + 关闭按钮；图标与文案由调用方给。 */
export const DialogHeader = ({
  icon,
  iconClassName,
  title,
  subtitle,
  subtitleTitle,
  onClose,
}: DialogHeaderProps) => (
  <div className="flex items-center justify-between gap-3 mb-5 shrink-0">
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            iconClassName,
          )}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-text leading-tight truncate">{title}</h2>
        {subtitle && (
          <p
            className="text-xs text-text-muted mt-0.5 truncate max-w-72"
            title={subtitleTitle ?? subtitle}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {onClose && <DialogCloseButton onClick={onClose} />}
  </div>
)

interface DialogCloseButtonProps {
  onClick: () => void
}

export const DialogCloseButton = ({ onClick }: DialogCloseButtonProps) => {
  const { t } = useTranslation()

  return (
    <IconButton variant="close" label={t(($) => $.common.close)} onClick={onClick}>
      <X className="w-4 h-4 stroke-current stroke-2" />
    </IconButton>
  )
}

interface DialogFooterProps {
  children: React.ReactNode
  /** 与正文分隔的上边框，用于内容较长的弹窗 */
  bordered?: boolean
  /** 上间距由调用方按上下文给 */
  className?: string
}

export const DialogFooter = ({ children, bordered = false, className }: DialogFooterProps) => (
  <div
    className={cn(
      'flex justify-end gap-2.5 shrink-0',
      bordered && 'pt-4 border-t border-border',
      className,
    )}
  >
    {children}
  </div>
)
