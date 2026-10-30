import { z } from 'zod'
import type { ConnectRequest, FileInfo, OperationResult } from '../types/index.js'
import { defineContract } from './define.js'
import { resultSchemaOf, voidResultSchema } from './schema.js'

const connectRequestSchema = z.custom<ConnectRequest>()
const fileInfoSchema = z.custom<FileInfo>()
const operationResultSchema = z.custom<OperationResult>()

/**
 * `requestId` 只作为请求参数存在：渲染层用它把 AbortSignal 桥接成主进程取消，
 * 响应一律是 `Result` 信封，不再回传 requestId。
 */
export const protocolContract = defineContract({
  'protocol.connect': {
    args: [connectRequestSchema],
    result: resultSchemaOf(operationResultSchema),
  },
  'protocol.disconnect': {
    args: [z.string(), z.string().optional()],
    result: voidResultSchema,
  },
  'protocol.list': {
    args: [z.string(), z.string(), z.string().optional()],
    result: resultSchemaOf(z.array(fileInfoSchema)),
  },
  'protocol.mkdir': {
    args: [z.string(), z.string(), z.string().optional()],
    result: voidResultSchema,
  },
  'protocol.rename': {
    args: [z.string(), fileInfoSchema, z.string(), z.string().optional()],
    result: voidResultSchema,
  },
  'protocol.delete': {
    args: [z.string(), fileInfoSchema, z.string().optional()],
    result: voidResultSchema,
  },
  'protocol.copy': {
    args: [z.string(), fileInfoSchema, z.string(), z.string().optional()],
    result: voidResultSchema,
  },
  'protocol.move': {
    args: [z.string(), fileInfoSchema, z.string(), z.string().optional()],
    result: voidResultSchema,
  },
  'protocol.cancel': { args: [z.string()], result: z.void() },
  'protocol.calculateFolderStats': {
    args: [z.string(), z.string()],
    result: resultSchemaOf(z.void()),
  },
  'protocol.cancelCalculateFolderStats': { args: [z.string()], result: z.void() },
})
