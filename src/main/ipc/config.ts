import { configContract } from '@shared/contract/config.contract.js'
import { getConfigurationValue, setConfigurationValue } from '../stores/index.js'
import { registerContract } from './register.js'

export function setupConfigIpcHandlers(): void {
  registerContract(configContract, {
    'config.get': (key) => getConfigurationValue(key),
    'config.set': (key, value) => setConfigurationValue(key, value),
  })
}
