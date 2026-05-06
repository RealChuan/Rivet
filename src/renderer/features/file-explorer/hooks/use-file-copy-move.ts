import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ERROR_CODE,
  FILE_OPERATION,
  FILE_TYPE,
  type FileType,
  TOAST_TYPE,
} from '@shared/constants/index.js'
import {
  createErrorInfo,
  err,
  type ErrorInfo,
  type FileInfo,
  ok,
  type Result,
} from '@shared/types/index.js'
import { generateUniqueFilename, isSubPath, joinPaths } from '@shared/utils/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import { logger } from '../../../utils/index.js'
import { type ConflictItem, type ConflictResolution } from '../components/ConflictDialog.js'
import { useDirectoryInvalidation } from './use-directory-invalidation.js'
import { useFileOperation } from './use-file-operation.js'

type CopyMoveOperation = typeof FILE_OPERATION.COPY | typeof FILE_OPERATION.MOVE

interface UseFileCopyMoveReturn {
  handleCopy: (files: FileInfo[]) => void
  handleMove: (files: FileInfo[]) => void
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

  const [targetFolderDialogOpen, setTargetFolderDialogOpen] = useState(false)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [pendingOperation, setPendingOperation] = useState<CopyMoveOperation | null>(null)
  const [pendingFiles, setPendingFiles] = useState<FileInfo[]>([])
  const [pendingTargetDir, setPendingTargetDir] = useState<FileInfo | null>(null)
  const [conflicts, setConflicts] = useState<ConflictItem[]>([])
  const [targetFilesCache, setTargetFilesCache] = useState<Map<string, FileType>>(new Map())

  const handleCopy = (files: FileInfo[]) => {
    setPendingFiles(files)
    setPendingOperation(FILE_OPERATION.COPY)
    setTargetFolderDialogOpen(true)
  }

  const handleMove = (files: FileInfo[]) => {
    setPendingFiles(files)
    setPendingOperation(FILE_OPERATION.MOVE)
    setTargetFolderDialogOpen(true)
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

      if (resolution) {
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

    for (const pendingFile of pendingFiles) {
      if (
        pendingFile.type === FILE_TYPE.DIRECTORY &&
        isSubPath(pendingFile.absolutePath, targetDir.absolutePath)
      ) {
        const errorMessage =
          pendingOperation === FILE_OPERATION.COPY
            ? t(($) => $.toast.cannotCopyToSelf)
            : t(($) => $.toast.cannotMoveToSelf)
        return err(createErrorInfo(ERROR_CODE.SELF_CONTAINED, errorMessage))
      }
    }

    let targetFiles: FileInfo[]
    try {
      targetFiles = await protocolApi.list(sessionId, targetDir.absolutePath)
    } catch (error) {
      const msg = error instanceof Error ? error.message : t(($) => $.error.unknown)
      return err(createErrorInfo(ERROR_CODE.LIST_FAILED, msg))
    }

    const existingFiles = new Map(targetFiles.map((f) => [f.name, f]))
    setTargetFilesCache(new Map(targetFiles.map((f) => [f.name, f.type])))

    const foundConflicts: ConflictItem[] = []
    for (const file of pendingFiles) {
      const existingFile = existingFiles.get(file.name)
      if (existingFile) {
        foundConflicts.push({
          sourceFile: file,
          targetFile: existingFile,
          targetExists: true,
        })
      }
    }

    if (foundConflicts.length > 0) {
      setConflicts(foundConflicts)
      setPendingTargetDir(targetDir)
      setConflictDialogOpen(true)
      setTargetFolderDialogOpen(false)
      return ok(undefined)
    }

    setTargetFolderDialogOpen(false)

    void executeOperation(
      pendingFiles,
      targetDir,
      new Map(),
      new Map(targetFiles.map((f) => [f.name, f.type])),
    )

    return ok(undefined)
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
      setConflicts([])
      setTargetFilesCache(new Map())
      return
    }

    try {
      const resolutionsMap = new Map(resolutions.map((r) => [r.sourceFile.absolutePath, r]))
      setConflictDialogOpen(false)
      await executeOperation(pendingFilesList, pendingTargetDirValue, resolutionsMap, cache, op)
    } finally {
      setConflictDialogOpen(false)
      setPendingOperation(null)
      setPendingFiles([])
      setPendingTargetDir(null)
      setConflicts([])
      setTargetFilesCache(new Map())
    }
  }

  return {
    handleCopy,
    handleMove,
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
