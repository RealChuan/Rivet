// 只放与 Electron/Node 无关的纯逻辑
export const getCallerInfo = (skipFrames: number = 3): string => {
  const err = new Error()
  const stack = err.stack?.split('\n') ?? []
  if (stack.length > skipFrames) {
    const callerLine = stack[skipFrames]?.trim()
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

export const formatMessage = (message: string, isDev: boolean, callerInfo: string) => {
  return isDev ? `${callerInfo} ${message}` : message
}
