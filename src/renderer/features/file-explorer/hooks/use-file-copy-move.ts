import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ERROR_CODE,
  FILE_OPERATION,
  FILE_TYPE,
  type FileType,
  ROOT_PATH,
  TOAST_TYPE,
} from '@shared/constants/index.js'
import {
  createErrorInfo,
  err,
  type ErrorInfo,
  type FileInfo,
  isOk,
  ok,
  type Result,
} from '@shared/types/index.js'
import {
  generateUniqueFilename,
  getParentPath,
  isSubPath,
  joinPaths,
  pathBasename,
} from '@shared/utils/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import { logger } from '../../../utils/index.js'
import { type ConflictItem, type ConflictResolution } from '../components/ConflictDialog.js'
import { CLIPBOARD_MODE, useFileClipboardStore } from '../stores/clipboard.js'
import { useDirectoryInvalidation } from './use-directory-invalidation.js'
import { useFileOperation } from './use-file-operation.js'

type CopyMoveOperation = typeof FILE_OPERATION.COPY | typeof FILE_OPERATION.MOVE

const EMPTY_PATHS: ReadonlySet<string> = new Set()

export interface UseFileCopyMoveReturn {
  /** 打开“复制到...”目标目录对话框 */
  handleCopyTo: (files: FileInfo[]) => void
  /** 打开“移动到...”目标目录对话框 */
  handleMoveTo: (files: FileInfo[]) => void
  /** 复制到内建剪贴板 */
  handleCopy: (files: FileInfo[]) => void
  /** 剪切到内建剪贴板 */
  handleCut: (files: FileInfo[]) => void
  /** 粘贴到指定目录 */
  handlePaste: (targetPath: string) => Promise<Result<void, ErrorInfo>>
  canPaste: boolean
  /** 剪贴板中被剪切的条目，供列表/宫格置灰 */
  cutPaths: ReadonlySet<string>
  handleSelectTargetFolder: (targetDir: FileInfo) => Promise<Result<void, ErrorInfo>>
  handleConflictResolution: (
    resolutions: ConflictResolution[],
    operation?: CopyMoveOperation | null,
    files?: FileInfo[],
    targetDir?: FileInfo | null,
  ) => Promise<void>
  targetFolderDialogOpen: boolean
  conflictDialogOpen: boolean
  conflicts: ConflictItem[]
  pendingOperation: CopyMoveOperation | null | undefined
  pendingFiles: FileInfo[]
  pendingTargetDir: FileInfo | null | undefined
  setTargetFolderDialogOpen: (open: boolean) => void
  setConflictDialogOpen: (open: boolean) => void
}

export const useFileCopyMove = (sessionId: string): UseFileCopyMoveReturn => {
  const { t } = useTranslation()
  const { invalidateSession } = useDirectoryInvalidation()
  const addToast = useUiStore((state) => state.addToast)
  const { execute } = useFileOperation(sessionId)

  const clipboardSessionId = useFileClipboardStore((state) => state.sessionId)
  const clipboardMode = useFileClipboardStore((state) => state.mode)
  const clipboardFiles = useFileClipboardStore((state) => state.files)
  const setClipboard = useFileClipboardStore((state) => state.setClipboard)
  const clearClipboard = useFileClipboardStore((state) => state.clear)

  const [targetFolderDialogOpen, setTargetFolderDialogOpen] = useState(false)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [pendingOperation, setPendingOperation] = useState<CopyMoveOperation | null>(null)
  const [pendingFiles, setPendingFiles] = useState<FileInfo[]>([])
  const [pendingTargetDir, setPendingTargetDir] = useState<FileInfo | null>(null)
  const [pendingFromClipboard, setPendingFromClipboard] = useState(false)
  const [conflicts, setConflicts] = useState<ConflictItem[]>([])
  const [targetFilesCache, setTargetFilesCache] = useState<Map<string, FileType>>(new Map())

  const canPaste = clipboardSessionId === sessionId && clipboardFiles.length > 0

  const cutPaths = useMemo(() => {
    if (clipboardMode !== CLIPBOARD_MODE.CUT || clipboardSessionId !== sessionId) {
      return EMPTY_PATHS
    }
    return new Set(clipboardFiles.map((file) => file.absolutePath))
  }, [clipboardFiles, clipboardMode, clipboardSessionId, sessionId])

  /** 目录对话框与粘贴共用的入口：校验、探测冲突、执行 */
  const runOperation = async (
    files: FileInfo[],
    operation: CopyMoveOperation,
    targetDir: FileInfo,
    fromClipboard = false,
  ): Promise<Result<void, ErrorInfo>> => {
    if (files.length === 0) {
      return err(
        createErrorInfo(
          ERROR_CODE.INVALID_STATE,
          t(($) => $.error.noOperationPending),
        ),
      )
    }

    for (const file of files) {
      if (
        file.type === FILE_TYPE.DIRECTORY &&
        isSubPath(file.absolutePath, targetDir.absolutePath)
      ) {
        const errorMessage =
          operation === FILE_OPERATION.COPY
            ? t(($) => $.toast.cannotCopyToSelf)
            : t(($) => $.toast.cannotMoveToSelf)
        return err(createErrorInfo(ERROR_CODE.SELF_CONTAINED, errorMessage))
      }
    }

    // 移动到自身所在目录是空操作，Windows 下同样直接忽略。
    const candidates =
      operation === FILE_OPERATION.MOVE
        ? files.filter((file) => getParentPath(file.absolutePath) !== targetDir.absolutePath)
        : files

    if (candidates.length === 0) return ok(undefined)

    let targetFiles: FileInfo[]
    try {
      targetFiles = await protocolApi.list(sessionId, targetDir.absolutePath)
    } catch (error) {
      const msg = error instanceof Error ? error.message : t(($) => $.error.unknown)
      return err(createErrorInfo(ERROR_CODE.LIST_FAILED, msg))
    }

    const existingFiles = new Map(targetFiles.map((f) => [f.name, f]))
    const existingTypes = new Map(targetFiles.map((f) => [f.name, f.type]))
    setTargetFilesCache(existingTypes)

    const foundConflicts: ConflictItem[] = []
    for (const file of candidates) {
      const existingFile = existingFiles.get(file.name)
      // 复制到自身所在目录时自动生成副本名，不弹覆盖确认。
      const isSelfTarget = joinPaths(targetDir.absolutePath, file.name) === file.absolutePath
      if (existingFile && !isSelfTarget) {
        foundConflicts.push({
          sourceFile: file,
          targetFile: existingFile,
          targetExists: true,
        })
      }
    }

    setTargetFolderDialogOpen(false)

    if (foundConflicts.length > 0) {
      setConflicts(foundConflicts)
      setPendingOperation(operation)
      setPendingFiles(candidates)
      setPendingTargetDir(targetDir)
      setPendingFromClipboard(fromClipboard)
      setConflictDialogOpen(true)
      return ok(undefined)
    }

    void executeOperation(candidates, targetDir, new Map(), existingTypes, operation, fromClipboard)

    return ok(undefined)
  }

  const handleCopyTo = (files: FileInfo[]) => {
    setPendingFiles(files)
    setPendingOperation(FILE_OPERATION.COPY)
    setPendingFromClipboard(false)
    setTargetFolderDialogOpen(true)
  }

  const handleMoveTo = (files: FileInfo[]) => {
    setPendingFiles(files)
    setPendingOperation(FILE_OPERATION.MOVE)
    setPendingFromClipboard(false)
    setTargetFolderDialogOpen(true)
  }

  const handleCopy = (files: FileInfo[]) => {
    setClipboard(sessionId, CLIPBOARD_MODE.COPY, files)
  }

  const handleCut = (files: FileInfo[]) => {
    setClipboard(sessionId, CLIPBOARD_MODE.CUT, files)
  }

  const toTargetDir = (path: string): FileInfo => ({
    name: path === ROOT_PATH ? ROOT_PATH : pathBasename(path),
    type: FILE_TYPE.DIRECTORY,
    size: 0,
    modifyTime: 0,
    permissions: '',
    owner: '',
    absolutePath: path,
  })

  const handlePaste = async (targetPath: string): Promise<Result<void, ErrorInfo>> => {
    if (!canPaste || !clipboardMode) {
      const error = createErrorInfo(
        ERROR_CODE.INVALID_STATE,
        t(($) => $.error.noOperationPending),
      )
      addToast({ type: TOAST_TYPE.ERROR, message: error.message })
      return err(error)
    }

    const operation =
      clipboardMode === CLIPBOARD_MODE.CUT ? FILE_OPERATION.MOVE : FILE_OPERATION.COPY
    const result = await runOperation(clipboardFiles, operation, toTargetDir(targetPath), true)

    if (!isOk(result)) {
      addToast({ type: TOAST_TYPE.ERROR, message: result.error.message })
    }

    return result
  }

  const getTargetPath = (fileName: string, targetDir: string): string => {
    return joinPaths(targetDir, fileName)
  }

  const executeOperation = async (
    files: FileInfo[],
    targetDir: FileInfo,
    resolutionsMap: Map<string, ConflictResolution>,
    existingNames?: Map<string, FileType>,
    operation?: CopyMoveOperation,
    fromClipboard = false,
  ) => {
    const op = operation ?? pendingOperation
    const targetFilesMap = existingNames ?? new Map()
    const existingNamesSet = new Set<string>(targetFilesMap.keys())

    const itemsToProcess: Array<{ file: FileInfo; targetPath: string }> = []

    for (const file of files) {
      const defaultTargetPath = getTargetPath(file.name, targetDir.absolutePath)
      const resolution = resolutionsMap.get(file.absolutePath)

      let targetPath = defaultTargetPath
      let shouldProcess = true

      if (defaultTargetPath === file.absolutePath) {
        // 复制回原目录：换名而不是覆盖自己。
        const uniqueName = generateUniqueFilename(file.name)
        targetPath = getTargetPath(uniqueName, targetDir.absolutePath)
        existingNamesSet.add(uniqueName)
      } else if (resolution) {
        if (resolution.strategy === 'skip') {
          shouldProcess = false
        } else if (resolution.strategy === 'keepBoth') {
          const uniqueName = generateUniqueFilename(file.name)
          targetPath = getTargetPath(uniqueName, targetDir.absolutePath)
          existingNamesSet.add(uniqueName)
        }
      } else if (existingNamesSet.has(file.name)) {
        const uniqueName = generateUniqueFilename(file.name)
        targetPath = getTargetPath(uniqueName, targetDir.absolutePath)
        existingNamesSet.add(uniqueName)
      }

      if (!shouldProcess) continue

      itemsToProcess.push({ file, targetPath })
    }

    logger.info(`[${op?.toUpperCase() ?? 'Unknown'}] Processing ${itemsToProcess.length} items`)

    return execute(async () => {
      for (const { file, targetPath } of itemsToProcess) {
        try {
          if (op === FILE_OPERATION.COPY) {
            await protocolApi.copy(sessionId, file, targetPath)
          } else {
            await protocolApi.move(sessionId, file, targetPath)
          }
        } catch (error) {
          addToast({
            type: TOAST_TYPE.ERROR,
            message:
              op === FILE_OPERATION.COPY
                ? `${t(($) => $.toast.copyFailed)}: ${resolveErrorMessage(t, error)}`
                : `${t(($) => $.toast.moveFailed)}: ${resolveErrorMessage(t, error)}`,
          })
          return
        }
      }

      if (op === FILE_OPERATION.COPY) {
        addToast({ type: TOAST_TYPE.SUCCESS, message: t(($) => $.toast.copySuccess) })
      } else {
        addToast({ type: TOAST_TYPE.SUCCESS, message: t(($) => $.toast.moveSuccess) })
      }

      // 剪切粘贴成功后清空剪贴板；复制粘贴保留，方便连续粘贴。
      if (fromClipboard && op === FILE_OPERATION.MOVE) {
        clearClipboard()
      }

      await invalidateSession(sessionId)
    })
  }

  const handleSelectTargetFolder = async (
    targetDir: FileInfo,
  ): Promise<Result<void, ErrorInfo>> => {
    if (!pendingOperation || pendingFiles.length === 0) {
      return err(
        createErrorInfo(
          ERROR_CODE.INVALID_STATE,
          t(($) => $.error.noOperationPending),
        ),
      )
    }

    const fromClipboard = pendingFromClipboard
    setPendingFromClipboard(false)

    return runOperation(pendingFiles, pendingOperation, targetDir, fromClipboard)
  }

  const handleConflictResolution = async (
    resolutions: ConflictResolution[],
    operation?: CopyMoveOperation | null,
    files?: FileInfo[],
    targetDir?: FileInfo | null,
  ) => {
    const op = operation ?? pendingOperation
    const pendingFilesList = files ?? pendingFiles
    const pendingTargetDirValue = targetDir ?? pendingTargetDir
    const cache = new Map(targetFilesCache)

    if (!op || !pendingFilesList || pendingFilesList.length === 0 || !pendingTargetDirValue) {
      setConflictDialogOpen(false)
      setPendingOperation(null)
      setPendingFiles([])
      setPendingTargetDir(null)
      setPendingFromClipboard(false)
      setConflicts([])
      setTargetFilesCache(new Map())
      return
    }

    try {
      const resolutionsMap = new Map(resolutions.map((r) => [r.sourceFile.absolutePath, r]))
      setConflictDialogOpen(false)
      await executeOperation(
        pendingFilesList,
        pendingTargetDirValue,
        resolutionsMap,
        cache,
        op,
        pendingFromClipboard,
      )
    } finally {
      setConflictDialogOpen(false)
      setPendingOperation(null)
      setPendingFiles([])
      setPendingTargetDir(null)
      setPendingFromClipboard(false)
      setConflicts([])
      setTargetFilesCache(new Map())
    }
  }

  return {
    handleCopyTo,
    handleMoveTo,
    handleCopy,
    handleCut,
    handlePaste,
    canPaste,
    cutPaths,
    handleSelectTargetFolder,
    handleConflictResolution,
    targetFolderDialogOpen,
    conflictDialogOpen,
    conflicts,
    pendingOperation,
    pendingFiles,
    pendingTargetDir,
    setTargetFolderDialogOpen,
    setConflictDialogOpen,
  }
}

export default useFileCopyMove
