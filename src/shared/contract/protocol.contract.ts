import { z } from 'zod'
import type {
  ConnectRequest,
  FileInfo,
  ListBucketsRequest,
  OperationResult,
} from '../types/index.js'
import { defineContract } from './define.js'
import { resultSchemaOf, voidResultSchema } from './schema.js'

const connectRequestSchema = z.custom<ConnectRequest>()
const listBucketsRequestSchema = z.custom<ListBucketsRequest>()
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
  'protocol.listBuckets': {
    args: [listBucketsRequestSchema],
    result: resultSchemaOf(z.array(z.string())),
  },
  /**
   * `limit` 是本次列举的上限（默认 `MAX_LIST_ENTRIES`）：「加载更多」用一个更大的值重列，
   * 保持无状态，排序与过滤始终看到同一份完整结果。
   */
  'protocol.list': {
    args: [z.string(), z.string(), z.string().optional(), z.number().int().positive().optional()],
    result: resultSchemaOf(z.array(fileInfoSchema)),
  },
  'protocol.stat': {
    args: [z.string(), z.string(), z.string().optional()],
    result: resultSchemaOf(fileInfoSchema),
  },
  'protocol.mkdir': {
    args: [z.string(), z.string(), z.string().optional()],
    result: voidResultSchema,
  },
  'protocol.rename': {
    args: [z.string(), fileInfoSchema, z.string(), z.string().optional()],
    result: voidResultSchema,
  },
  /** `mode` 是完整权限位（含 setuid/setgid/sticky），上限 0o7777。 */
  'protocol.chmod': {
    args: [z.string(), fileInfoSchema, z.number().int().min(0).max(0o7777), z.string().optional()],
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
