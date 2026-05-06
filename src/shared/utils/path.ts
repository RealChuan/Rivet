/**
 * 规范化路径：去除多余的斜杠和当前目录引用
 */
export const normalizePath = (path: string): string => {
  if (typeof path !== 'string') throw new TypeError('path must be a string')
  const isAbsolute = path.startsWith('/')
  const segments = path.split('/').filter((s) => s !== '' && s !== '.')
  return isAbsolute ? '/' + segments.join('/') : segments.join('/')
}

/**
 * 检测路径是否包含遍历组件（..）
 * 先进行 URL 解码再检查，防止编码绕过
 * 返回规范化后的安全路径，或抛出错误
 */
export const sanitizePath = (path: string): string => {
  // 先尝试 URL 解码，检测编码后的路径遍历
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(path)
  } catch {
    // decodeURIComponent 可能抛出 URIError（如 %E0%A4%A 编码不完整）
    // 此时使用原始路径继续检查
    decodedPath = path
  }

  // 对解码后的路径检查路径遍历
  const normalized = normalizePath(decodedPath)
  const segments = normalized.split('/').filter(Boolean)
  if (segments.includes('..')) {
    throw new Error(`Path traversal detected`)
  }

  // 返回原始路径的规范化结果（保留编码字符，由服务器解析）
  return normalizePath(path)
}

export const joinPaths = (...parts: string[]): string => {
  const filtered = parts.filter(Boolean).join('/')
  return normalizePath(filtered)
}

export const getParentPath = (path: string): string => {
  if (path === '/') return '/'
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return '/'
  return '/' + parts.slice(0, -1).join('/')
}

export const pathBasename = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] ?? ''
}

export const isSubPath = (parent: string, child: string): boolean => {
  const normalizedParent = normalizePath(parent)
  const normalizedChild = normalizePath(child)
  if (normalizedParent === normalizedChild) return true
  if (normalizedParent === '/') return normalizedChild !== '/'
  return normalizedChild.startsWith(normalizedParent + '/')
}
