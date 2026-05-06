/**
 * 把 `AbortSignal` 的取消转发到一次回调（通常是 `protocol.cancel(requestId)`）。
 * 返回的清理函数必须可重复调用。
 */
export function forwardAbort(signal: AbortSignal | undefined, onAbort: () => void): () => void {
  if (!signal) {
    return () => {}
  }

  if (signal.aborted) {
    onAbort()
    return () => {}
  }

  const handler = () => {
    onAbort()
  }

  signal.addEventListener('abort', handler, { once: true })

  return () => {
    signal.removeEventListener('abort', handler)
  }
}
