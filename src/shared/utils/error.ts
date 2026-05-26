export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    const result = JSON.stringify(error)
    if (result === undefined) return String(error)
    return result
  } catch {
    return String(error)
  }
}
