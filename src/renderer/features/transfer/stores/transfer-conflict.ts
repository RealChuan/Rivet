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
  confirm: (resolutions: ConflictResolution[]) => void
  cancel: () => void
}

export const useTransferConflictStore = create<TransferConflictState & TransferConflictActions>()(
  (set, get) => ({
    conflicts: [],
    dialogOpen: false,
    _resolveRef: null,

    openDialog: (conflicts, resolve) => {
      set({ conflicts, dialogOpen: true, _resolveRef: resolve })
    },

    confirm: resolutions => {
      const { _resolveRef } = get()
      set({ conflicts: [], dialogOpen: false, _resolveRef: null })
      _resolveRef?.(resolutions)
    },

    cancel: () => {
      const { _resolveRef } = get()
      set({ conflicts: [], dialogOpen: false, _resolveRef: null })
      _resolveRef?.(null)
    },
  })
)
