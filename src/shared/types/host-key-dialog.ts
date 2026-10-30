import type { HostKeyDialogType } from '@shared/constants/ui.js'

export interface HostKeyVerificationDialogState {
  open: boolean
  type: HostKeyDialogType
  host: string
  port: number
  algorithm: string
  fingerprint: string
  previousFingerprint: string | undefined
}
