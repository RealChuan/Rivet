import { TRANSFER_DIRECTION } from '@shared/constants/index.js'
import { transferContract } from '@shared/contract/transfer.contract.js'
import { ok } from '@shared/domain/result.js'
import { transferService } from '../services/transfer/index.js'
import { getTransferSettings, setTransferSettings } from '../stores/index.js'
import { registerContract } from './register.js'

export function setupTransferIpcHandlers(): void {
  registerContract(transferContract, {
    'transfer.add': async (tasks) => ok(await transferService.addTasks(tasks)),
    'transfer.cancel': async (taskId) => {
      await transferService.cancel(taskId)
      return ok(undefined)
    },
    'transfer.cancelAll': (sessionId) => {
      transferService.cancelAll(sessionId)
      return ok(undefined)
    },
    'transfer.retry': async (taskId) => {
      await transferService.retry(taskId)
      return ok(undefined)
    },
    'transfer.retryAll': (sessionId) => {
      transferService.retryAll(sessionId)
      return ok(undefined)
    },
    'transfer.getTasks': (sessionId) => ok(transferService.getTasks(sessionId)),
    'transfer.getConcurrency': (direction) => ok(transferService.getConcurrency(direction)),
    'transfer.setConcurrency': (max, direction) => {
      transferService.setConcurrency(max, direction)
      const current = getTransferSettings()
      const value = transferService.getConcurrency(direction)
      return setTransferSettings(
        direction === TRANSFER_DIRECTION.UPLOAD
          ? { ...current, maxUploadConcurrency: value }
          : { ...current, maxDownloadConcurrency: value },
      )
    },
    'transfer.checkLocalFiles': async (localDir) =>
      ok(await transferService.checkLocalFiles(localDir)),
    'transfer.getLastDir': (key) => ok(transferService.getLastDir(key)),
    'transfer.setLastDir': (key, dir) => {
      transferService.setLastDir(key, dir)
      return ok(undefined)
    },
  })
}
