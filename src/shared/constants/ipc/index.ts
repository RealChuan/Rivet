import { CONFIG_CHANNELS } from './config.js'
import { CRYPTO_CHANNELS } from './crypto.js'
import { DIALOG_CHANNELS } from './dialog.js'
import { EVENTS_CHANNELS } from './events.js'
import { HOST_KEY_CHANNELS } from './host-key.js'
import { PROTOCOL_CHANNELS } from './protocol.js'
import { SYSTEM_CHANNELS } from './system.js'
import { TRANSFER_CHANNELS } from './transfer.js'
import { WINDOW_CHANNELS } from './window.js'

export { CONFIG_CHANNELS } from './config.js'
export { CRYPTO_CHANNELS } from './crypto.js'
export { DIALOG_CHANNELS } from './dialog.js'
export { EVENTS_CHANNELS } from './events.js'
export { HOST_KEY_CHANNELS } from './host-key.js'
export { PROTOCOL_CHANNELS } from './protocol.js'
export { SYSTEM_CHANNELS } from './system.js'
export { TRANSFER_CHANNELS } from './transfer.js'
export { WINDOW_CHANNELS } from './window.js'

export const IPC_CHANNELS = {
  WINDOW: WINDOW_CHANNELS,
  PROTOCOL: PROTOCOL_CHANNELS,
  CONFIG: CONFIG_CHANNELS,
  DIALOG: DIALOG_CHANNELS,
  HOST_KEY: HOST_KEY_CHANNELS,
  SYSTEM: SYSTEM_CHANNELS,
  CRYPTO: CRYPTO_CHANNELS,
  EVENTS: EVENTS_CHANNELS,
  TRANSFER: TRANSFER_CHANNELS,
} as const
