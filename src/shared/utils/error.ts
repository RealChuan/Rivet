export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export function fireAndForget<T>(promise: Promise<T> | void, errorMessage?: string): void {
  if (!promise) return
  promise.catch(error => {
    const errMsg = toErrorMessage(error)
    console.error(errorMessage ? `${errorMessage}: ${errMsg}` : `Unhandled error: ${errMsg}`)
  })
}
