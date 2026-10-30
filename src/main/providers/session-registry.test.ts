import { describe, expect, it } from 'vitest'
import type { ConnectionConfig } from '@shared/types/index.js'
import { SessionRegistry } from './session-registry.js'
import { createFakeProvider } from './test-utils/fake-provider.js'

const config: ConnectionConfig = {
  id: 'conn-1',
  name: 'Test',
  protocol: 'sftp',
  host: 'localhost',
  port: 22,
  username: 'user',
}

describe('SessionRegistry', () => {
  it('按 sessionId 存取同一个 provider 实例', () => {
    const registry = new SessionRegistry()
    const provider = createFakeProvider()
    registry.register('s1', { provider, config, protocolType: 'sftp', isClosing: false })

    expect(registry.get('s1')?.provider).toBe(provider)
    expect(registry.has('s1')).toBe(true)
    expect(registry.count).toBe(1)

    registry.unregister('s1')
    expect(registry.get('s1')).toBeUndefined()
    expect(registry.has('s1')).toBe(false)
  })

  it('setClosing 只影响目标会话', () => {
    const registry = new SessionRegistry()
    registry.register('s1', {
      provider: createFakeProvider('sftp'),
      config,
      protocolType: 'sftp',
      isClosing: false,
    })
    registry.register('s2', {
      provider: createFakeProvider('webdav'),
      config,
      protocolType: 'webdav',
      isClosing: false,
    })

    registry.setClosing('s1')

    expect(registry.get('s1')?.isClosing).toBe(true)
    expect(registry.get('s2')?.isClosing).toBe(false)
  })

  it('getAllIds 与 clear 覆盖全部会话', () => {
    const registry = new SessionRegistry()
    registry.register('s1', {
      provider: createFakeProvider(),
      config,
      protocolType: 'sftp',
      isClosing: false,
    })
    registry.register('s2', {
      provider: createFakeProvider('webdav'),
      config,
      protocolType: 'webdav',
      isClosing: false,
    })

    expect(registry.getAllIds().sort()).toEqual(['s1', 's2'])

    registry.clear()
    expect(registry.count).toBe(0)
  })
})
