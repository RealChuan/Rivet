export const normalizePath = (path: string): string => {
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return '/'
  return '/' + parts.join('/')
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

export const isSubPath = (parent: string, child: string): boolean => {
  const normalizedParent = normalizePath(parent)
  const normalizedChild = normalizePath(child)
  if (normalizedParent === normalizedChild) return true
  return normalizedChild.startsWith(normalizedParent + '/')
}

export const joinPath = (parent: string, child: string): string => {
  if (parent === '/') return `/${child}`
  return `${parent}/${child}`
}
