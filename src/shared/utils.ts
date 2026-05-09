export const getCallerInfo = (): string => {
  const err = new Error()
  const stack = err.stack?.split('\n') || []
  if (stack.length >= 4) {
    const callerLine = stack[3].trim()
    const match =
      callerLine.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) ||
      callerLine.match(/at\s+(.+?):(\d+):(\d+)/)
    if (match) {
      const funcName = match[1] || 'anonymous'
      const filePath = match.length === 5 ? match[2] : match[1]
      const lineNum = match.length === 5 ? match[3] : match[2]
      const fileName = filePath.split(/[\\/]/).pop() || 'unknown'
      return `[${fileName}:${lineNum} ${funcName}]`
    }
  }
  return '[unknown]'
}

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

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const formatDate = (timestamp: number): string => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString()
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
