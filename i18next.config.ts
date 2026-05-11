import { defineConfig } from 'i18next-cli'

export default defineConfig({
  locales: ['zh-CN', 'en-US'],
  extract: {
    input: ['src/renderer/**/*.{ts,tsx}', '!src/renderer/i18n/locales/**'],
    output: 'src/renderer/i18n/locales/{{lng}}.json',
    keySeparator: '.',
    nsSeparator: ':',
    // @ts-ignore - func 属性在当前版本类型定义中未声明
    func: {
      list: ['t'],
    },
    trans: {
      component: 'Trans',
    },
  },
})
