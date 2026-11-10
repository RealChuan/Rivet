import { useEffect } from 'react'
import { SUPPORTED_LANGUAGE } from '@shared/constants/index.js'
import { appApi } from '../api/app.js'
import { useUiStore } from '../stores/index.js'

/**
 * 主进程需要一份当前语言：托盘菜单与系统通知都由它生成。
 * 语言只在渲染层切换，这里负责把结果同步过去。
 */
export const useLocaleSync = () => {
  const locale = useUiStore((state) => state.locale)
  const initialized = useUiStore((state) => state.initialized)

  useEffect(() => {
    if (!initialized) return
    if (locale !== SUPPORTED_LANGUAGE.ZH_CN && locale !== SUPPORTED_LANGUAGE.EN_US) return
    appApi.setLocale(locale)
  }, [initialized, locale])
}
