// 由 `pnpm run i18n:types`（i18next-cli types）生成 resources.d.ts；
// 本文件只保留 CustomTypeOptions，不再手写 key 树。
import type Resources from './resources.js'

declare module 'i18next' {
  interface CustomTypeOptions {
    enableSelector: true
    defaultNS: 'translation'
    resources: Resources
  }
}
