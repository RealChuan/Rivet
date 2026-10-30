import { z } from 'zod'
import type { LastDirKey, TransferDirection } from '../constants/index.js'
import type { LocalFileInfo, TransferTask } from '../types/transfer.js'
import { defineContract } from './define.js'
import { resultSchemaOf, voidResultSchema } from './schema.js'

const transferTaskSchema = z.custom<TransferTask>()
const localFileInfoSchema = z.custom<LocalFileInfo>()
const directionSchema = z.custom<TransferDirection>()
const lastDirKeySchema = z.custom<LastDirKey>()

/**
 * 所有通道统一返回 `Result` 信封：成功带 value，失败带 AppError。
 * 不一致的返回形状会让渲染层在失败路径上直接 TypeError。
 */
export const transferContract = defineContract({
  'transfer.add': {
    args: [z.array(transferTaskSchema)],
    result: resultSchemaOf(
      z.object({
        added: z.array(transferTaskSchema),
        duplicates: z.array(transferTaskSchema),
      }),
    ),
  },
  'transfer.cancel': { args: [z.string()], result: voidResultSchema },
  'transfer.cancelAll': { args: [z.string().optional()], result: voidResultSchema },
  'transfer.retry': { args: [z.string()], result: voidResultSchema },
  'transfer.retryAll': { args: [z.string().optional()], result: voidResultSchema },
  'transfer.getTasks': {
    args: [z.string().optional()],
    result: resultSchemaOf(z.array(transferTaskSchema)),
  },
  'transfer.getConcurrency': { args: [directionSchema], result: resultSchemaOf(z.number()) },
  'transfer.setConcurrency': {
    args: [z.number(), directionSchema],
    result: voidResultSchema,
  },
  'transfer.checkLocalFiles': {
    args: [z.string()],
    result: resultSchemaOf(z.array(localFileInfoSchema)),
  },
  'transfer.getLastDir': {
    args: [lastDirKeySchema],
    result: resultSchemaOf(z.string().nullable()),
  },
  'transfer.setLastDir': { args: [lastDirKeySchema, z.string()], result: voidResultSchema },
})
