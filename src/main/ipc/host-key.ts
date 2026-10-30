import { hostKeyContract } from '@shared/contract/hostkey.contract.js'
import { trustHostKey } from '../stores/known-hosts.js'
import { registerContract } from './register.js'

export function setupHostKeyIpcHandlers(): void {
  registerContract(hostKeyContract, {
    'hostKey.trust': (record) => trustHostKey(record),
  })
}
