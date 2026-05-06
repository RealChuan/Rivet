import { XMLParser } from 'fast-xml-parser'
import { normalizePath, pathBasename } from '@shared/utils/index.js'
import { isHttpSuccess, statusLineCode } from './http-status.js'

export interface PropfindEntry {
  /** 解码后的绝对路径。 */
  readonly href: string
  readonly name: string
  readonly size: number
  readonly lastModified: number
  readonly isDirectory: boolean
}

export interface ParseMultistatusOptions {
  /** `stat` 的 Depth:0 响应需要保留 basePath 自身。 */
  includeSelf?: boolean
}

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): unknown[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function decodeHref(href: string): string {
  let path = href

  if (/^https?:\/\//i.test(href)) {
    try {
      path = new URL(href).pathname
    } catch {
      path = href
    }
  }

  const withoutQuery = path.split(/[?#]/)[0] ?? path

  try {
    return normalizePath(decodeURIComponent(withoutQuery))
  } catch {
    return normalizePath(withoutQuery)
  }
}

function isDirectoryProp(prop: Record<string, unknown>): boolean {
  const resourceType = prop.resourcetype
  return isRecord(resourceType) && 'collection' in resourceType
}

function okPropstat(response: Record<string, unknown>): Record<string, unknown> | null {
  for (const candidate of asArray(response.propstat)) {
    if (!isRecord(candidate)) continue
    const code = statusLineCode(asString(candidate.status) ?? '')
    if (code === null || !isHttpSuccess(code)) continue
    return isRecord(candidate.prop) ? candidate.prop : {}
  }
  return null
}

/**
 * 解析 207 Multi-Status。默认过滤掉 basePath 自身（Depth:1 列表用）。
 */
export function parseMultistatus(
  xml: string,
  basePath: string,
  options: ParseMultistatusOptions = {},
): PropfindEntry[] {
  const parsed: unknown = parser.parse(xml)
  if (!isRecord(parsed) || !isRecord(parsed.multistatus)) return []

  const base = normalizePath(basePath)
  const entries: PropfindEntry[] = []

  for (const rawResponse of asArray(parsed.multistatus.response)) {
    if (!isRecord(rawResponse)) continue
    const rawHref = asString(rawResponse.href)
    if (!rawHref) continue

    const href = decodeHref(rawHref)
    if (!options.includeSelf && href === base) continue

    const prop = okPropstat(rawResponse)
    if (!prop) continue

    const rawSize = asString(prop.getcontentlength)
    const size = rawSize !== undefined ? Number(rawSize) : 0
    const rawLastModified = asString(prop.getlastmodified)
    const parsedTime = rawLastModified ? Date.parse(rawLastModified) : Number.NaN

    entries.push({
      href,
      name: pathBasename(href),
      size: Number.isFinite(size) ? size : 0,
      lastModified: Number.isFinite(parsedTime) ? parsedTime : 0,
      isDirectory: isDirectoryProp(prop),
    })
  }

  return entries
}
