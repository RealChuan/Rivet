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
