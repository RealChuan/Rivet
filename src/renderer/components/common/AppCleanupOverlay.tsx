import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appApi } from '../../api/app.js'

/**
 * 退出前清理临时文件的遮罩。清理没有超时，可能持续几秒，
 * 所以要明确告诉用户在做什么，而不是让窗口静静卡住。
 */
export const AppCleanupOverlay = () => {
  const { t } = useTranslation()
  const [cleaning, setCleaning] = useState(false)

  useEffect(() => appApi.onCleanupStarted(() => setCleaning(true)), [])

  if (!cleaning) return null

  return (
    <div
      data-testid="cleanup-overlay"
      className="fixed inset-0 z-9999 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-sm"
    >
      <Loader2 className="w-6 h-6 animate-spin text-accent" />
      <p className="text-sm text-text">{t(($) => $.app.cleaningTemps)}</p>
    </div>
  )
}

export default AppCleanupOverlay
