import type { OpenDialogOptions, SaveDialogOptions } from 'electron'
import { dialogContract } from '@shared/contract/dialog.contract.js'
import { showOpenDialog, showSaveDialog } from '../utils/index.js'
import { registerContract } from './register.js'

export function setupDialogIpcHandlers(): void {
  registerContract(dialogContract, {
    'dialog.showOpenDialog': (options) => showOpenDialog(options as unknown as OpenDialogOptions),
    'dialog.showSaveDialog': (options) => showSaveDialog(options as unknown as SaveDialogOptions),
  })
}
