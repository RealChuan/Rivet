import { create } from 'zustand'
import type { FileInfo } from '@shared/types/index.js'

export const CLIPBOARD_MODE = {
  COPY: 'copy',
  CUT: 'cut',
} as const

export type ClipboardMode = (typeof CLIPBOARD_MODE)[keyof typeof CLIPBOARD_MODE]

interface FileClipboardStore {
  /** 剪贴板只在同一连接内生效；sessionId 不匹配时不允许粘贴 */
  sessionId: string | null
  mode: ClipboardMode | null
  files: FileInfo[]
  setClipboard: (sessionId: string, mode: ClipboardMode, files: FileInfo[]) => void
  clear: () => void
}

export const useFileClipboardStore = create<FileClipboardStore>((set) => ({
  sessionId: null,
  mode: null,
  files: [],
  setClipboard: (sessionId, mode, files) => set({ sessionId, mode, files }),
  clear: () => set({ sessionId: null, mode: null, files: [] }),
}))
