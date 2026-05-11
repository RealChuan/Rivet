export * from './format.js'
export * from './path.js'
export * from './caller.js'
export * from './session.js'

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
