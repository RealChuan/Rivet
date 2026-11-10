import i18next from 'i18next'
import { SUPPORTED_LANGUAGE } from '@shared/constants/index.js'
import enUS from '@shared/i18n/locales/en-US.json' with { type: 'json' }
import zhCN from '@shared/i18n/locales/zh-CN.json' with { type: 'json' }

/** 主进程只用到少量文案，键在这里收敛成联合类型，改 key 时能被 tsc 抓到。 */
export type MainTranslationKey =
  'tray.show' | 'tray.quit' | 'notification.completed' | 'notification.failed'

function normalizeLocale(locale: string): string {
  return locale === SUPPORTED_LANGUAGE.ZH_CN ? SUPPORTED_LANGUAGE.ZH_CN : SUPPORTED_LANGUAGE.EN_US
}

/** 与渲染层共用同一份语言资源；`initAsync: false` 保证托盘创建前就能取到文案。 */
export function initializeI18n(locale: string): void {
  void i18next.init({
    lng: normalizeLocale(locale),
    fallbackLng: SUPPORTED_LANGUAGE.EN_US,
    resources: {
      [SUPPORTED_LANGUAGE.ZH_CN]: zhCN,
      [SUPPORTED_LANGUAGE.EN_US]: enUS,
    },
    initAsync: false,
    interpolation: { escapeValue: false },
  })
}

export async function setMainLocale(locale: string): Promise<void> {
  await i18next.changeLanguage(normalizeLocale(locale))
}

export function mainT(key: MainTranslationKey): string {
  return i18next.t(key)
}
