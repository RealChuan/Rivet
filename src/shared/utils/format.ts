import { SUPPORTED_LANGUAGE } from '@shared/constants/i18n.js'

export const formatFileSize = (bytes: number, lng: string = 'en-US'): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  const value = bytes / Math.pow(k, i)
  const formattedValue = new Intl.NumberFormat(lng, {
    maximumFractionDigits: 2,
  }).format(parseFloat(value.toFixed(2)))
  return `${formattedValue} ${sizes[i]}`
}

export const formatDate = (timestamp: number, lng: string = SUPPORTED_LANGUAGE.EN_US): string => {
  if (!timestamp) return '-'
  return new Intl.DateTimeFormat(lng, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}
