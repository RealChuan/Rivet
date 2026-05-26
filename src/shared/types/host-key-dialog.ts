export interface HostKeyVerificationDialogState {
  open: boolean
  type: 'first-connect' | 'mismatch'
  hash: string
  previousHash: string | undefined
  sessionId: string
  connectionId: string
}
