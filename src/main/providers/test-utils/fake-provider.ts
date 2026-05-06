import type { Credentials } from '@shared/domain/credentials.js'
import type { Capabilities, Entry, ProviderKind } from '@shared/domain/entry.js'
import type { FileProvider } from '../types.js'

export const FAKE_ENTRY: Entry = {
  name: 'file.txt',
  kind: 'file',
  size: 3,
  mtime: 0,
  path: '/file.txt',
}

export const FAKE_CAPABILITIES: Capabilities = {
  chmod: false,
  symlink: false,
  serverSideCopy: false,
  serverSideMove: true,
  atomicRename: true,
  dirIsEntity: true,
  caseSensitive: true,
}

export function createFakeProvider(kind: ProviderKind = 'sftp'): FileProvider {
  return {
    kind,
    capabilities: FAKE_CAPABILITIES,
    connect: (_credentials: Credentials) => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    ping: () => Promise.resolve(),
    list: () =>
      (async function* () {
        await Promise.resolve()
        yield FAKE_ENTRY
      })(),
    stat: () => Promise.resolve(FAKE_ENTRY),
    mkdir: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    rename: () => Promise.resolve(),
    openRead: () =>
      Promise.resolve({
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close()
          },
        }),
        close: () => Promise.resolve(),
      }),
    openWrite: () =>
      Promise.resolve({
        stream: new WritableStream<Uint8Array>(),
        commit: () => Promise.resolve(),
        abort: () => Promise.resolve(),
      }),
  }
}
