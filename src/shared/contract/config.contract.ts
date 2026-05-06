import { z } from 'zod'
import { defineContract } from './define.js'
import { resultSchemaOf, voidResultSchema } from './schema.js'

export const configContract = defineContract({
  'config.get': { args: [z.string()], result: resultSchemaOf(z.unknown()) },
  'config.set': { args: [z.string(), z.unknown()], result: voidResultSchema },
})
