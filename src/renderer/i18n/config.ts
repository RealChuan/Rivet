import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from './locales/zh-CN.json' with { type: 'json' }
import enUS from './locales/en-US.json' with { type: 'json' }
import { ZH_CN, EN_US } from '@shared/constants/i18n.js'

const resources = {
  [ZH_CN]: zhCN,
  [EN_US]: enUS,
}

void i18n.use(initReactI18next).init({
  resources,
  lng: EN_US,
  fallbackLng: EN_US,
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
