import { expectTypeOf, it } from 'vitest'
import type { Entry, ProviderKind } from '@shared/domain/entry.js'
import type { ProviderFactoryOptions } from './registry.js'
import type { FileProvider } from './types.js'
import { createProvider } from './registry.js'

it('list 返回 AsyncIterable<Entry>', () => {
  expectTypeOf<FileProvider['list']>().returns.toEqualTypeOf<AsyncIterable<Entry>>()
})

it('createProvider 的第一个参数是 ProviderKind 而不是 string', () => {
  expectTypeOf(createProvider).parameter(0).toEqualTypeOf<ProviderKind>()
})

it('未登记的协议是编译错误', () => {
  // @ts-expect-error 'smb' 尚未登记到 ProviderKind
  createProvider('smb', {} as ProviderFactoryOptions)
})
