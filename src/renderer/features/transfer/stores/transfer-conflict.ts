import { create } from 'zustand'
import type { ConflictItem, ConflictResolution } from '@shared/types/transfer.js'

interface TransferConflictState {
  conflicts: ConflictItem[]
  dialogOpen: boolean
  _resolveRef: ((resolutions: ConflictResolution[] | null) => void) | null
}

interface TransferConflictActions {
  openDialog: (
    conflicts: ConflictItem[],
    resolve: (resolutions: ConflictResolution[] | null) => void
  ) => void
  closeDialog: () => void
  clearAll: () => void
}

export const useTransferConflictStore = create<TransferConflictState & TransferConflictActions>(
  set => ({
    conflicts: [],
    dialogOpen: false,
    _resolveRef: null,

    openDialog: (conflicts, resolve) => set({ conflicts, dialogOpen: true, _resolveRef: resolve }),

    closeDialog: () => set({ dialogOpen: false }),

    clearAll: () => set({ conflicts: [], dialogOpen: false, _resolveRef: null }),
  })
)
