import { normalizePath } from '@shared/utils/index.js'

/**
 * 把连接配置里的 `basePath` 规范成桶内前缀：不带首尾斜杠，根目录为空串。
 * 前缀本身是 key 的字面量片段，不做任何 URL 编码（S3 的编码交给 SDK）。
 */
export function normalizeRootPrefix(basePath: string | undefined): string {
  return (basePath ?? '').replace(/^\/+/, '').replace(/\/+$/, '')
}

/** UI 路径 → 对象 key；根路径返回前缀本身。 */
export function toObjectKey(rootPrefix: string, path: string): string {
  const normalized = normalizePath(path)
  if (normalized === '/') return rootPrefix
  const relative = normalized.slice(1)
  return rootPrefix === '' ? relative : `${rootPrefix}/${relative}`
}

/** 列表用的前缀：目录对应的 key 追加斜杠，避免 `photo` 前缀命中 `photos`。 */
export function toListPrefix(rootPrefix: string, path: string): string {
  const normalized = normalizePath(path)
  if (normalized === '/') return rootPrefix === '' ? '' : `${rootPrefix}/`
  return `${toObjectKey(rootPrefix, path)}/`
}

/** 对象 key → UI 路径；前缀之外的 key 返回 null。 */
export function toVirtualPath(rootPrefix: string, key: string): string | null {
  if (rootPrefix === '') return key === '' ? '/' : `/${key}`

  if (key === rootPrefix) return '/'
  const prefix = `${rootPrefix}/`
  if (!key.startsWith(prefix)) return null
  return `/${key.slice(prefix.length)}`
}
