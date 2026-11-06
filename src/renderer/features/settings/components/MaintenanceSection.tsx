import { FolderOpen } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { formatFileSize } from '@shared/utils/index.js'
import { systemApi } from '../../../api/system.js'
import { Button } from '../../../components/ui/index.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import SettingsRow from './SettingsRow.js'

interface LogCacheSnapshot {
  dir: string
  bytes: number
}

const ACTION_CLASS = 'px-3 py-1.5 text-xs'

/** 维护分区：日志位置 + 缓存（旧日志）大小与清理。 */
export const MaintenanceSection = () => {
  const { t, i18n } = useTranslation()
  const addToast = useUiStore((state) => state.addToast)
  const [logDir, setLogDir] = useState('')
  const [cacheBytes, setCacheBytes] = useState<number | null>(null)
  const [isClearing, setIsClearing] = useState(false)

  const load = useCallback(async (): Promise<LogCacheSnapshot> => {
    const [dir, bytes] = await Promise.all([systemApi.getLogDir(), systemApi.getLogCacheSize()])
    return { dir, bytes }
  }, [])

  useEffect(() => {
    void load()
      .then((snapshot) => {
        setLogDir(snapshot.dir)
        setCacheBytes(snapshot.bytes)
      })
      .catch((error: unknown) => {
        addToast({ type: TOAST_TYPE.ERROR, message: resolveErrorMessage(t, error) })
      })
  }, [addToast, load, t])

  const handleOpen = async () => {
    try {
      await systemApi.openLogDir()
    } catch (error) {
      addToast({ type: TOAST_TYPE.ERROR, message: resolveErrorMessage(t, error) })
    }
  }

  const handleClear = async () => {
    setIsClearing(true)
    try {
      const freed = await systemApi.clearLogCache()
      addToast({
        type: TOAST_TYPE.SUCCESS,
        message: t(($) => $.settings.cache.clearSuccess, {
          size: formatFileSize(freed, i18n.language),
        }),
      })
      const snapshot = await load()
      setLogDir(snapshot.dir)
      setCacheBytes(snapshot.bytes)
    } catch (error) {
      addToast({ type: TOAST_TYPE.ERROR, message: resolveErrorMessage(t, error) })
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div>
      <p className="text-xs text-text-muted leading-relaxed">{t(($) => $.settings.cache.hint)}</p>
      <div className="mt-3 flex flex-col divide-y divide-border">
        <SettingsRow
          label={t(($) => $.settings.log.dir)}
          description={<span className="font-mono text-2xs">{logDir || '-'}</span>}
        >
          <Button
            variant="secondary"
            className={ACTION_CLASS}
            onClick={() => void handleOpen()}
            data-testid="settings-open-log-dir"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            {t(($) => $.settings.log.open)}
          </Button>
        </SettingsRow>

        <SettingsRow
          label={t(($) => $.settings.cache.size)}
          descriptionTestId="settings-cache-size"
          description={
            <span className="tabular-nums text-text">
              {cacheBytes === null ? '-' : formatFileSize(cacheBytes, i18n.language)}
            </span>
          }
        >
          <Button
            variant="secondary"
            className={ACTION_CLASS}
            isLoading={isClearing}
            onClick={() => void handleClear()}
            data-testid="settings-clear-cache"
          >
            {t(($) => $.settings.cache.clear)}
          </Button>
        </SettingsRow>
      </div>
    </div>
  )
}

export default MaintenanceSection
