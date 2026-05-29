export * from './error.js'
export * from './format.js'
export * from './i18n.js'
export * from './ipc-result.js'
export * from './logger-formatter.js'
export * from './path.js'

export const generateUniqueFilename = (basename: string): string => {
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
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}_${String(now.getMilliseconds()).padStart(3, '0')}`
  const newName = `${name}_${timestamp}${ext}`

  return newName
}
