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
})
