import type { HostKeyTrustRequest } from '@shared/types/index.js'
import { unwrap } from './result.js'

export const hostKeyApi = {
  trust: async (record: HostKeyTrustRequest): Promise<void> => {
    unwrap(await window.electronAPI.hostKey.trust(record))
  },
}
