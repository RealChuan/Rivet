import { z } from 'zod'
import type { OpenTerminalRequest } from '../types/terminal.js'
import { defineContract } from './define.js'
import { resultSchemaOf, voidResultSchema } from './schema.js'

const openTerminalRequestSchema = z.custom<OpenTerminalRequest>()

/** 输出按原始字节传：字符串会在 chunk 边界切裂多字节字符，中文必乱码。 */
const bytesSchema = z.custom<Uint8Array>()

/**
 * 终端：`open` / `close` 走请求响应，`write` / `resize` 走单向，
 * 输出与退出用事件下发——交互式字节流不适合 Result 信封。
 */
export const terminalContract = defineContract({
  'terminal.open': {
    args: [openTerminalRequestSchema],
    result: resultSchemaOf(z.object({ terminalId: z.string() })),
  },
  'terminal.close': {
    args: [z.string()],
    result: voidResultSchema,
  },
})

export const terminalOneWayContract = defineContract({
  'terminal.write': {
    args: [z.string(), bytesSchema],
    result: z.void(),
  },
  'terminal.resize': {
    args: [z.string(), z.number().int().positive(), z.number().int().positive()],
    result: z.void(),
  },
})
