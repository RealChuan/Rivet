import { app } from 'electron'
import {
  initializeConnections,
  flushConnections,
  disposeConnections,
} from './connections-repository.js'
import { initializeKnownHosts, flushKnownHosts, disposeKnownHosts } from './known-hosts.js'
import { initializeSettings, flushSettings, disposeSettings } from './settings-repository.js'

export * from './config-facade.js'
export * from './connections-repository.js'
export * from './known-hosts.js'
export * from './settings-repository.js'

export function initializeStores(baseDir: string = app.getPath('userData')): void {
  initializeSettings(baseDir)
  initializeConnections(baseDir)
  initializeKnownHosts(baseDir)
}

export async function flushStores(): Promise<void> {
  await Promise.all([flushSettings(), flushConnections(), flushKnownHosts()])
}

export async function disposeStores(): Promise<void> {
  await Promise.all([disposeSettings(), disposeConnections(), disposeKnownHosts()])
}
