import { z } from 'zod'
import { defineContract } from './define.js'
import { resultSchemaOf } from './schema.js'

export const systemContract = defineContract({
  'system.getTempDir': { args: [], result: resultSchemaOf(z.string()) },
  'system.getDownloadDir': { args: [], result: resultSchemaOf(z.string()) },
  'system.supportsGlass': { args: [], result: z.boolean() },
  'system.generateUuid': { args: [], result: z.string() },
})
