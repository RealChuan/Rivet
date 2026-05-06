import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { SUPPORTED_LANGUAGE } from '@shared/constants/index.js'
import enUS from './locales/en-US.json' with { type: 'json' }
import zhCN from './locales/zh-CN.json' with { type: 'json' }

const resources = {
  [SUPPORTED_LANGUAGE.ZH_CN]: zhCN,
  [SUPPORTED_LANGUAGE.EN_US]: enUS,
}

void i18n.use(initReactI18next).init({
  resources,
  lng: SUPPORTED_LANGUAGE.EN_US,
  fallbackLng: SUPPORTED_LANGUAGE.EN_US,
  enableSelector: true,
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
