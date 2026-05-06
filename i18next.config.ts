import { defineConfig } from 'i18next-cli'

export default defineConfig({
  locales: ['zh-CN', 'en-US'],
  extract: {
    input: ['src/renderer/**/*.{ts,tsx}', '!src/renderer/i18n/locales/**'],
    output: 'src/renderer/i18n/locales/{{lng}}.json',
    keySeparator: '.',
    nsSeparator: ':',
    // 语言文件是单文件多命名空间结构（顶层 translation），类型生成需要同一约定。
    mergeNamespaces: true,
    func: {
      list: ['t'],
    } as { list: string[] },
    trans: {
      component: 'Trans',
    },
  },
  types: {
    input: 'src/renderer/i18n/locales/en-US.json',
    output: 'src/renderer/i18n/i18next.d.ts',
    resourcesFile: 'src/renderer/i18n/resources.d.ts',
    enableSelector: true,
  },
})
