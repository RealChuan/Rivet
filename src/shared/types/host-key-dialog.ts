export interface HostKeyDialogState {
  open: boolean
  type: 'first-connect' | 'mismatch'
  fingerprint: string
  previousFingerprint: string | undefined
  sessionId: string
  connectionUuid: string
}
