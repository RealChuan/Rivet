import { create } from 'zustand'
import type { HostKeyVerificationDialogState } from '@shared/types/index.js'

export const useHostKeyStore = create<{
  hostKeyDialog: HostKeyVerificationDialogState & { onConfirm?: () => void; onCancel?: () => void }
  setHostKeyVerificationDialog: (
    state: Partial<
      HostKeyVerificationDialogState & { onConfirm?: () => void; onCancel?: () => void }
    >
  ) => void
}>(set => ({
  hostKeyDialog: {
    open: false,
    type: 'first-connect',
    hash: '',
    previousHash: undefined,
    sessionId: '',
    connectionId: '',
  },

  setHostKeyVerificationDialog: state => {
    set(prev => ({
      hostKeyDialog: { ...prev.hostKeyDialog, ...state },
    }))
  },
}))

export default useHostKeyStore
