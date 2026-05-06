import { hostKeyTrustRequestSchema } from '../types/host-key.js'
import { defineContract } from './define.js'
import { voidResultSchema } from './schema.js'

export const hostKeyContract = defineContract({
  'hostKey.trust': { args: [hostKeyTrustRequestSchema], result: voidResultSchema },
})
