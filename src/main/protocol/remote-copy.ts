import type { EntryKind } from '@shared/domain/entry.js'
import { joinPaths } from '@shared/utils/index.js'
import type { FileProvider } from '../providers/types.js'

export interface CopyRemoteOptions {
  signal: AbortSignal
  overwrite: boolean
}

/**
 * 远端复制。provider 有服务端 copy 能力时直接用；
 * 否则用 openRead → openWrite 的通用路径，目录则递归展开。
 */
export async function copyRemoteEntry(
  provider: FileProvider,
  source: { path: string; kind: EntryKind },
  targetPath: string,
  opts: CopyRemoteOptions,
): Promise<void> {
  opts.signal.throwIfAborted()

  if (source.kind === 'directory') {
    await copyDirectory(provider, source.path, targetPath, opts)
    return
  }

  if (provider.copy && provider.capabilities.serverSideCopy) {
    await provider.copy(source.path, targetPath, opts.signal)
    return
  }

  await copyStream(provider, source.path, targetPath, opts)
}

async function copyDirectory(
  provider: FileProvider,
  sourcePath: string,
  targetPath: string,
  opts: CopyRemoteOptions,
): Promise<void> {
  await provider.mkdir(targetPath, { recursive: true, signal: opts.signal })

  for await (const entry of provider.list(sourcePath, { signal: opts.signal })) {
    opts.signal.throwIfAborted()
    await copyRemoteEntry(
      provider,
      { path: entry.path, kind: entry.kind },
      joinPaths(targetPath, entry.name),
      opts,
    )
  }
}

async function copyStream(
  provider: FileProvider,
  sourcePath: string,
  targetPath: string,
  opts: CopyRemoteOptions,
): Promise<void> {
  const read = await provider.openRead(sourcePath, { signal: opts.signal })

  try {
    const write = await provider.openWrite(targetPath, {
      overwrite: opts.overwrite,
      signal: opts.signal,
    })

    try {
      await read.stream.pipeTo(write.stream, { signal: opts.signal })
      await write.commit()
    } catch (error) {
      await write.abort().catch(() => {})
      throw error
    }
  } finally {
    await read.close().catch(() => {})
  }
}
