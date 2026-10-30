import { z } from 'zod'
import { defineContract } from './define.js'
import { resultSchemaOf } from './schema.js'

export const windowContract = defineContract({
  'window.getState': {
    args: [],
    result: resultSchemaOf(z.object({ isMaximized: z.boolean() })),
  },
})

export const windowOneWayContract = defineContract({
  'window.minimize': { args: [], result: z.void() },
  'window.toggleMaximize': { args: [], result: z.void() },
  'window.close': { args: [], result: z.void() },
})
