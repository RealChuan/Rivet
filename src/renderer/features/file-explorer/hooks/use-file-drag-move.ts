import { type DragEvent as ReactDragEvent, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FILE_TYPE, TOAST_TYPE } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
import { getParentPath, joinPaths } from '@shared/utils/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import { useSessionStore } from '../../session/stores/session.js'
import { showFileDragImage } from '../utils/drag-image.js'
import { useDirectoryInvalidation } from './use-directory-invalidation.js'
import { type SelectionModel } from './use-selection.js'

/** 行内拖动用的私有 MIME：容器上的「拖入上传」只认 `Files`，不会误触。 */
export const FILE_DRAG_MIME = 'application/x-rivet-paths'

/** 投放目标的三种状态：没被指到、可以放、被挡住。 */
export type FileDropState = 'none' | 'allowed' | 'forbidden'

export interface FileDropTarget {
  path: string
  allowed: boolean
}

export interface FileDragMove {
  draggingPaths: ReadonlySet<string>
  dropTarget: FileDropTarget | null
  /** 原生拖拽的全部准备工作都收在这里：载荷、私有 MIME、拖拽图。 */
  beginDrag: (event: ReactDragEvent<HTMLElement>, file: FileInfo) => void
  endDrag: () => void
  /** 返回是否允许投放：调用方据此设置 `dropEffect`，让系统光标显示禁止。 */
  dragOver: (file: FileInfo) => boolean
  dragLeave: () => void
  dropOn: (file: FileInfo) => void
}

/** 拖进自己或自己的子目录会让条目凭空消失，必须先挡掉。 */
function isSelfOrDescendant(sourcePath: string, targetDir: string): boolean {
  return targetDir === sourcePath || targetDir.startsWith(`${sourcePath}/`)
}

/** 目标是任一被拖动条目本身、或落在它内部时，整次拖拽都不允许投放到那里。 */
export function isForbiddenDropTarget(
  dragged: readonly { absolutePath: string }[],
  targetDir: string,
): boolean {
  return dragged.some((entry) => isSelfOrDescendant(entry.absolutePath, targetDir))
}

/** 列表行 / 网格单元用：把共享的投放目标换算成这一行自己的状态。 */
export function dropStateOf(target: FileDropTarget | null, path: string): FileDropState {
  if (target?.path !== path) return 'none'
  return target.allowed ? 'allowed' : 'forbidden'
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
  const [dropTarget, setDropTarget] = useState<FileDropTarget | null>(null)
  const draggedRef = useRef<FileInfo[]>([])

  const endDrag = useCallback(() => {
    draggedRef.current = []
    setDraggingPaths(new Set())
    setDropTarget(null)
  }, [])

  const beginDrag = useCallback(
    (event: ReactDragEvent<HTMLElement>, file: FileInfo) => {
      const files = selection.isSelected(file.absolutePath) ? selection.selectedEntries : [file]
      draggedRef.current = files
      setDraggingPaths(new Set(files.map((entry) => entry.absolutePath)))

      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData(FILE_DRAG_MIME, file.absolutePath)

      // 名称固定取列表里的第一项（`selectedEntries` 按目录顺序返回），
      // 不跟着光标抓住的那一项变，同样的选择怎么拖都长一个样。
      const [primary] = files
      if (primary === undefined) return

      const others = files.length - 1
      showFileDragImage(
        event.dataTransfer,
        primary.name,
        others > 0 ? t(($) => $.fileExplorerList.dragMoreItems, { count: others }) : null,
      )
    },
    [selection, t],
  )

  const dragOver = useCallback((file: FileInfo): boolean => {
    if (file.type !== FILE_TYPE.DIRECTORY) return false
    const allowed = !isForbiddenDropTarget(draggedRef.current, file.absolutePath)
    setDropTarget({ path: file.absolutePath, allowed })
    return allowed
  }, [])

  const dragLeave = useCallback(() => setDropTarget(null), [])

  const dropOn = useCallback(
    (target: FileInfo) => {
      const files = draggedRef.current
      // 必须在 endDrag 清空 draggedRef 之前判定，否则禁止规则会失忆。
      const forbidden = isForbiddenDropTarget(files, target.absolutePath)
      endDrag()
      if (target.type !== FILE_TYPE.DIRECTORY || files.length === 0 || forbidden) return

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

  return { draggingPaths, dropTarget, beginDrag, endDrag, dragOver, dragLeave, dropOn }
}
