import { z } from 'zod'
import { defineContract } from './define.js'
import { voidResultSchema } from './schema.js'

export const appContract = defineContract({
  'app.confirmClose': { args: [], result: voidResultSchema },
})

export const appOneWayContract = defineContract({
  'app.setTheme': {
    args: [z.enum(['light', 'dark', 'system'])],
    result: z.void(),
  },
  /** 渲染层切换语言后同步主进程，托盘与通知按新语言重建。 */
  'app.setLocale': {
    args: [z.enum(['zh-CN', 'en-US'])],
    result: z.void(),
  },
})
