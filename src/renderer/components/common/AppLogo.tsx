/**
 * AppLogo — 应用主图标
 *
 * 设计：铆钉（Rivet）俯视图，金属质感
 * - 固定渐变背景，不随昼夜模式变化
 */

export const AppLogo = () => {
  return (
    <div
      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
      style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}
    >
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {/* 铆钉头部（圆形） */}
        <circle cx="12" cy="12" r="9" fill="white" fillOpacity="0.92" />
        {/* 中心凹痕 */}
        <circle cx="12" cy="11.5" r="3" fill="white" fillOpacity="0.4" />
        {/* 高光弧线（金属质感） */}
        <path
          d="M7.5 7a7 7 0 0 1 4-2.5"
          stroke="white"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
