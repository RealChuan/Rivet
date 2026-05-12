export interface ProgressEvent {
  transferId: string
  connectionUuid: string
  operation: 'upload' | 'download'
  path: string
  percent: number
}
