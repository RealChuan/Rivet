export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export const formatDate = (timestamp: number): string => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleDateString()
}

export const normalizePath = (path: string): string => {
  const parts = path.split('/').filter(Boolean)
  return '/' + parts.join('/')
}

export const isSubPath = (parent: string, child: string): boolean => {
  const normalizedParent = normalizePath(parent)
  const normalizedChild = normalizePath(child)
  if (normalizedParent === normalizedChild) return true
  return normalizedChild.startsWith(normalizedParent + '/')
}

export const getParentPath = (path: string): string => {
  if (path === '/') return '/'
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return '/'
  return '/' + parts.slice(0, -1).join('/')
}

export const joinPath = (...parts: string[]): string => {
  const filtered = parts.filter(Boolean).join('/')
  return normalizePath(filtered)
}

export const generateUniqueName = (basename: string, existingNames: Set<string>): string => {
  const extIndex = basename.lastIndexOf('.')
  let name: string
  let ext: string
  if (extIndex > 0) {
    name = basename.substring(0, extIndex)
    ext = basename.substring(extIndex)
  } else {
    name = basename
    ext = ''
  }

  const now = new Date()
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  let newName = `${name}_${timestamp}${ext}`

  if (!existingNames.has(newName)) {
    return newName
  }

  for (let i = 1; i <= 10; i++) {
    newName = `${name}_${timestamp}_${i}${ext}`
    if (!existingNames.has(newName)) {
      return newName
    }
  }

  return `${name}_${timestamp}_11${ext}`
}
