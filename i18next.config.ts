import { defineConfig } from 'i18next-cli'

export default defineConfig({
  locales: ['zh-CN', 'en-US'],
  extract: {
    input: ['src/renderer/**/*.{ts,tsx}', '!src/renderer/i18n/locales/**'],
    output: 'src/renderer/i18n/locales/{{lng}}.json',
    keySeparator: '.',
    nsSeparator: ':',
    func: {
      list: ['t'],
    } as { list: string[] },
    trans: {
      component: 'Trans',
    },
  },
})
