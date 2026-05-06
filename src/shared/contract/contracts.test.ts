import { describe, expect, it } from 'vitest'
import { appContract, appOneWayContract } from './app.contract.js'
import { configContract } from './config.contract.js'
import { dialogContract } from './dialog.contract.js'
import { eventsContract } from './events.contract.js'
import { hostKeyContract } from './hostkey.contract.js'
import { invokeContract, oneWayContract } from './index.js'
import { protocolContract } from './protocol.contract.js'
import { systemContract } from './system.contract.js'
import { transferContract } from './transfer.contract.js'
import { windowContract, windowOneWayContract } from './window.contract.js'

/**
 * 通道名是 `namespace.method`，与旧常量一一对应（旧的 `namespace:method` 已随
 * `shared/constants/ipc/` 一起删除）。这里逐个钉死，防止改名时静默丢失通道。
 */
describe('通道契约', () => {
  it('app 契约', () => {
    expect(Object.keys(appContract)).toEqual(['app.confirmClose'])
    expect(Object.keys(appOneWayContract)).toEqual(['app.setTheme'])
  })

  it('config 契约', () => {
    expect(Object.keys(configContract)).toEqual(['config.get', 'config.set'])
  })

  it('dialog 契约', () => {
    expect(Object.keys(dialogContract)).toEqual(['dialog.showOpenDialog', 'dialog.showSaveDialog'])
  })

  it('hostKey 契约', () => {
    expect(Object.keys(hostKeyContract)).toEqual(['hostKey.trust'])
  })

  it('protocol 契约', () => {
    expect(Object.keys(protocolContract)).toEqual([
      'protocol.connect',
      'protocol.disconnect',
      'protocol.list',
      'protocol.mkdir',
      'protocol.rename',
      'protocol.delete',
      'protocol.copy',
      'protocol.move',
      'protocol.cancel',
      'protocol.calculateFolderStats',
      'protocol.cancelCalculateFolderStats',
    ])
  })

  it('transfer 契约', () => {
    expect(Object.keys(transferContract)).toEqual([
      'transfer.add',
      'transfer.cancel',
      'transfer.cancelAll',
      'transfer.retry',
      'transfer.retryAll',
      'transfer.getTasks',
      'transfer.getConcurrency',
      'transfer.setConcurrency',
      'transfer.checkLocalFiles',
      'transfer.getLastDir',
      'transfer.setLastDir',
    ])
  })

  it('window 契约', () => {
    expect(Object.keys(windowContract)).toEqual(['window.getState'])
    expect(Object.keys(windowOneWayContract)).toEqual([
      'window.minimize',
      'window.toggleMaximize',
      'window.close',
    ])
  })

  it('system 契约', () => {
    expect(Object.keys(systemContract)).toEqual([
      'system.getTempDir',
      'system.getDownloadDir',
      'system.supportsGlass',
      'system.generateUuid',
    ])
  })

  it('请求契约恰好是所有请求域之并集，无重复无遗漏', () => {
    const union = [
      ...Object.keys(appContract),
      ...Object.keys(configContract),
      ...Object.keys(dialogContract),
      ...Object.keys(hostKeyContract),
      ...Object.keys(protocolContract),
      ...Object.keys(systemContract),
      ...Object.keys(transferContract),
      ...Object.keys(windowContract),
    ]

    expect(Object.keys(invokeContract).sort()).toEqual(union.sort())
    expect(new Set(union).size).toBe(union.length)
    expect(Object.keys(invokeContract).some((channel) => channel in oneWayContract)).toBe(false)
  })

  it('单向契约恰好是 app 与 window 的并集', () => {
    expect(Object.keys(oneWayContract).sort()).toEqual(
      [...Object.keys(appOneWayContract), ...Object.keys(windowOneWayContract)].sort(),
    )
  })

  it('事件通道名与请求通道同构', () => {
    expect(Object.keys(eventsContract)).toEqual([
      'protocol.sessionDisconnected',
      'protocol.folderStatsProgress',
      'transfer.tasksEnqueued',
      'transfer.progress',
      'transfer.taskCompleted',
      'transfer.taskFailed',
      'transfer.taskRemoved',
      'app.closeRequested',
      'window.stateChanged',
    ])
  })
})
