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
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '_')
    .replace(/\.(\d{3})Z$/, '_$1')
  const newName = `${name}_${timestamp}${ext}`

  return newName
}
