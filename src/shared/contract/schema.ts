import { z } from 'zod'
import { appErrorSchema } from '../domain/error.js'

/**
 * 领域 `Result` 的契约描述：成功带 value，失败带 AppError。
 * 判别字段是 `success`，与 `src/shared/domain/result.ts` 一致。
 */
export function resultSchemaOf<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion('success', [
    z.object({ success: z.literal(true), value, error: z.null() }),
    z.object({ success: z.literal(false), value: z.null(), error: appErrorSchema }),
  ])
}

export const voidResultSchema = resultSchemaOf(z.void())
