export const getCallerInfo = (): string => {
  const err = new Error()
  const stack = err.stack?.split('\n') ?? []
  if (stack.length >= 4) {
    const callerLine = stack[3]?.trim()
    if (!callerLine) return '[unknown]'
    const match =
      callerLine.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) ??
      callerLine.match(/at\s+(.+?):(\d+):(\d+)/)
    if (match) {
      const funcName = match[1] ?? 'anonymous'
      const filePath = match.length === 5 ? match[2] : match[1]
      const lineNum = match.length === 5 ? match[3] : match[2]
      const fileName = filePath?.split(/[\\/]/).pop() ?? 'unknown'
      return `[${fileName}:${lineNum} ${funcName}]`
    }
  }
  return '[unknown]'
}
