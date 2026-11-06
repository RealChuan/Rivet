import type React from 'react'

interface SettingsRowProps {
  label: string
  /** 第二行说明或当前值；长文本会换行 */
  description?: React.ReactNode
  descriptionTestId?: string
  children: React.ReactNode
}

/** 设置项统一行：左侧标题与说明，右侧控件。列之间靠外层 divide-y 分隔。 */
export const SettingsRow = ({
  label,
  description,
  descriptionTestId,
  children,
}: SettingsRowProps) => (
  <div className="flex items-start justify-between gap-4 py-3">
    <div className="min-w-0">
      <div className="text-xs text-text">{label}</div>
      {description ? (
        <div
          {...(descriptionTestId ? { 'data-testid': descriptionTestId } : {})}
          className="mt-1 text-xs text-text-muted leading-relaxed break-words"
        >
          {description}
        </div>
      ) : null}
    </div>
    <div className="shrink-0 flex items-center self-center">{children}</div>
  </div>
)

export default SettingsRow
