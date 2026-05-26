import { WINDOW_CHANNELS } from './window.js'
import { PROTOCOL_CHANNELS } from './protocol.js'
import { CONFIG_CHANNELS } from './config.js'
import { DIALOG_CHANNELS } from './dialog.js'
import { HOST_KEY_CHANNELS } from './host-key.js'
import { SYSTEM_CHANNELS } from './system.js'
import { UTILS_CHANNELS } from './utils.js'
import { EVENTS_CHANNELS } from './events.js'

export { WINDOW_CHANNELS } from './window.js'
export { PROTOCOL_CHANNELS } from './protocol.js'
export { CONFIG_CHANNELS } from './config.js'
export { DIALOG_CHANNELS } from './dialog.js'
export { HOST_KEY_CHANNELS } from './host-key.js'
export { SYSTEM_CHANNELS } from './system.js'
export { UTILS_CHANNELS } from './utils.js'
export { EVENTS_CHANNELS } from './events.js'

export const IPC_CHANNELS = {
  WINDOW: WINDOW_CHANNELS,
  PROTOCOL: PROTOCOL_CHANNELS,
  CONFIG: CONFIG_CHANNELS,
  DIALOG: DIALOG_CHANNELS,
  HOST_KEY: HOST_KEY_CHANNELS,
  SYSTEM: SYSTEM_CHANNELS,
  UTILS: UTILS_CHANNELS,
  EVENTS: EVENTS_CHANNELS,
} as const

export type IpcChannels = typeof IPC_CHANNELS
