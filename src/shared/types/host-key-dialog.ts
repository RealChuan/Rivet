import type { HostKeyDialogType } from '@shared/constants/ui.js'

export interface HostKeyVerificationDialogState {
  open: boolean
  type: HostKeyDialogType
  hash: string
  previousHash: string | undefined
  sessionId: string
  connectionId: string
}
