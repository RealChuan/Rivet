import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FILE_TYPE, TOAST_TYPE } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
import { getParentPath, joinPaths } from '@shared/utils/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import { useSessionStore } from '../../session/stores/session.js'
import { useDirectoryInvalidation } from './use-directory-invalidation.js'
import { type SelectionModel } from './use-selection.js'

/** 行内拖动用的私有 MIME：容器上的「拖入上传」只认 `Files`，不会误触。 */
export const FILE_DRAG_MIME = 'application/x-rivet-paths'

export interface FileDragMove {
  draggingPaths: ReadonlySet<string>
  dropTargetPath: string | null
  beginDrag: (file: FileInfo) => void
  endDrag: () => void
  dragOver: (file: FileInfo) => void
  dragLeave: () => void
  dropOn: (file: FileInfo) => void
}

/** 拖进自己或自己的子目录会让条目凭空消失，必须先挡掉。 */
function isSelfOrDescendant(sourcePath: string, targetDir: string): boolean {
  return targetDir === sourcePath || targetDir.startsWith(`${sourcePath}/`)
}

/**
 * 远程目录内拖拽移动：把选中的条目拖到另一个目录上。
 * 只做移动（不跨协议复制），同名冲突直接拒绝而不是覆盖。
 */
export function useFileDragMove(sessionId: string, selection: SelectionModel): FileDragMove {
  const { t } = useTranslation()
  const addToast = useUiStore((state) => state.addToast)
  const { invalidateSession } = useDirectoryInvalidation()
  const [draggingPaths, setDraggingPaths] = useState<ReadonlySet<string>>(new Set())
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null)
  const draggedRef = useRef<FileInfo[]>([])

  const endDrag = useCallback(() => {
    draggedRef.current = []
    setDraggingPaths(new Set())
    setDropTargetPath(null)
  }, [])

  const beginDrag = useCallback(
    (file: FileInfo) => {
      const files = selection.isSelected(file.absolutePath) ? selection.selectedEntries : [file]
      draggedRef.current = files
      setDraggingPaths(new Set(files.map((entry) => entry.absolutePath)))
    },
    [selection],
  )

  const dragOver = useCallback((file: FileInfo) => {
    if (file.type !== FILE_TYPE.DIRECTORY) return
    setDropTargetPath(file.absolutePath)
  }, [])

  const dragLeave = useCallback(() => setDropTargetPath(null), [])

  const dropOn = useCallback(
    (target: FileInfo) => {
      const files = draggedRef.current
      endDrag()
      if (target.type !== FILE_TYPE.DIRECTORY || files.length === 0) return

      const targetDir = target.absolutePath
      const candidates = files.filter(
        (file) =>
          getParentPath(file.absolutePath) !== targetDir &&
          !isSelfOrDescendant(file.absolutePath, targetDir),
      )
      if (candidates.length === 0) return

      void (async () => {
        try {
          const existing = await protocolApi.list(sessionId, targetDir)
          const taken = new Set(existing.map((entry) => entry.name))
          const conflicts = candidates.filter((file) => taken.has(file.name))
          if (conflicts.length > 0) {
            addToast({ type: TOAST_TYPE.ERROR, message: t(($) => $.fileExplorerList.moveConflict) })
            return
          }

          const setOperating = useSessionStore.getState().setOperating
          setOperating(sessionId, true)
          for (const file of candidates) {
            await protocolApi.move(sessionId, file, joinPaths(targetDir, file.name))
          }
          await invalidateSession(sessionId)
        } catch (error) {
          addToast({
            type: TOAST_TYPE.ERROR,
            message: t(($) => $.fileExplorerList.moveFailed, {
              message: resolveErrorMessage(t, error),
            }),
          })
        } finally {
          useSessionStore.getState().setOperating(sessionId, false)
        }
      })()
    },
    [addToast, endDrag, invalidateSession, sessionId, t],
  )

  return { draggingPaths, dropTargetPath, beginDrag, endDrag, dragOver, dragLeave, dropOn }
}
