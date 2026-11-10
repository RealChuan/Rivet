import { clipboard } from 'electron'
import { clipboardContract } from '@shared/contract/clipboard.contract.js'
import { ok } from '@shared/types/index.js'
import { registerContract } from './register.js'

export function setupClipboardIpcHandlers(): void {
  registerContract(clipboardContract, {
    'clipboard.writeText': async (text) => {
      await clipboard.writeText(text)
      return ok(undefined)
    },
    'clipboard.readText': async () => ok(await clipboard.readText()),
  })
}
