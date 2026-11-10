import { z } from 'zod'
import { defineContract } from './define.js'
import { resultSchemaOf, voidResultSchema } from './schema.js'

/**
 * 系统剪贴板只在两个显式动作上访问：复制远端路径（写），以及「粘贴地址连接」（读）。
 * 远端路径的复制必须走主进程，渲染层的 `navigator.clipboard` 在自定义协议下不可靠。
 */
export const clipboardContract = defineContract({
  'clipboard.writeText': {
    args: [z.string()],
    result: voidResultSchema,
  },
  'clipboard.readText': {
    args: [],
    result: resultSchemaOf(z.string()),
  },
})
