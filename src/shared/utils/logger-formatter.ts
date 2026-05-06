// 只放与 Electron/Node 无关的纯逻辑
/**
 * 调用栈帧跳过层数。
 * - DIRECT_<SCOPE>：从对应 logger 的 createLogFn 返回函数直接调用算起
 * - CATCH_LOG：从 catchLog 调用方算起（多 1 层 catchLog 本身）
 * 任一包装层变动需同步调整。
 */
export const CALLER_DEPTH = {
  /** createLogFn 闭包：调用方 → createLogFn 闭包 → getCallerInfo，共 3 层 */
  DIRECT_RENDERER: 3,
  DIRECT_MAIN: 3,
  /** catchLog：调用方 → logger.catch → sharedCatchLog → getCallerInfo，共 4 层 */
  CATCH_LOG: 4,
} as const

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
      const funcName = match.length === 5 ? (match[1] ?? 'anonymous') : 'anonymous'
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

export function catchLog(
  logFn: (message: string, ...args: unknown[]) => void,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const callerInfo = getCallerInfo(CALLER_DEPTH.CATCH_LOG)
  const errorObj = error instanceof Error ? error : new Error(String(error))
  const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : ''
  const logMessage = `[${callerInfo}] ${errorObj.message}${contextStr}\nStack: ${errorObj.stack ?? ''}`
  logFn(logMessage)
}
