import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { useUiStore } from '@renderer/stores/index.js'
import { logger } from '@renderer/utils/index.js'
import { type FileInfo, isProtocolResponseErr } from '@shared/types/index.js'
import { type Result, ok, err, type ErrorInfo, createErrorInfo } from '@shared/types/result.js'
import {
  type ConflictItem,
  type ConflictResolution,
} from '@renderer/features/file-explorer/components/ConflictDialog.js'
import { isSubPath, generateUniqueFilename, formatErrorMessage } from '@shared/utils/index.js'
import { FILE_OPERATIONS, TOAST_TYPE } from '@shared/constants/index.js'

type CopyMoveOperation = typeof FILE_OPERATIONS.COPY | typeof FILE_OPERATIONS.MOVE

export interface UseFileCopyMoveReturn {
  handleCopy: (files: FileInfo[]) => void
  handleMove: (files: FileInfo[]) => void
  handleSelectTargetFolder: (targetDir: FileInfo) => Promise<Result<void, ErrorInfo>>
  handleConflictResolution: (
    resolutions: ConflictResolution[],
    operation?: CopyMoveOperation | null,
    files?: FileInfo[],
    targetDir?: FileInfo | null
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
  const refreshCurrentDirectory = useSessionStore(state => state.refreshCurrentDirectory)
  const addToast = useUiStore(state => state.addToast)

  const [targetFolderDialogOpen, setTargetFolderDialogOpen] = useState(false)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [pendingOperation, setPendingOperation] = useState<CopyMoveOperation | null>(null)
  const [pendingFiles, setPendingFiles] = useState<FileInfo[]>([])
  const [pendingTargetDir, setPendingTargetDir] = useState<FileInfo | null>(null)
  const [conflicts, setConflicts] = useState<ConflictItem[]>([])
  const [targetFilesCache, setTargetFilesCache] = useState<Map<string, 'file' | 'directory'>>(
    new Map()
  )
  const isHandlingConflictRef = useRef(false)

  const handleCopy = (files: FileInfo[]) => {
    setPendingFiles(files)
    setPendingOperation(FILE_OPERATIONS.COPY)
    setTargetFolderDialogOpen(true)
  }

  const handleMove = (files: FileInfo[]) => {
    setPendingFiles(files)
    setPendingOperation(FILE_OPERATIONS.MOVE)
    setTargetFolderDialogOpen(true)
  }

  const getTargetPath = (fileName: string, targetDir: string): string => {
    return targetDir === '/' ? `/${fileName}` : `${targetDir}/${fileName}`
  }

  const executeOperation = async (
    files: FileInfo[],
    targetDir: FileInfo,
    resolutionsMap: Map<string, ConflictResolution>,
    existingNames?: Map<string, 'file' | 'directory'>,
    operation?: CopyMoveOperation
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

    for (const { file, targetPath } of itemsToProcess) {
      let result
      if (op === FILE_OPERATIONS.COPY) {
        result = await window.electronAPI.protocol.copy(sessionId, file, targetPath)
      } else {
        result = await window.electronAPI.protocol.move(sessionId, file, targetPath)
      }

      if (isProtocolResponseErr(result)) {
        const errorMsg = formatErrorMessage(result.error) || t('error.unknown')
        if (op === FILE_OPERATIONS.COPY) {
          addToast({ type: TOAST_TYPE.ERROR, message: `${t('toast.copyFailed')}: ${errorMsg}` })
        } else {
          addToast({ type: TOAST_TYPE.ERROR, message: `${t('toast.moveFailed')}: ${errorMsg}` })
        }
        return
      }
    }

    if (op === FILE_OPERATIONS.COPY) {
      addToast({ type: TOAST_TYPE.SUCCESS, message: t('toast.copySuccess') })
    } else {
      addToast({ type: TOAST_TYPE.SUCCESS, message: t('toast.moveSuccess') })
    }

    await refreshCurrentDirectory(sessionId)
  }

  const handleSelectTargetFolder = async (
    targetDir: FileInfo
  ): Promise<Result<void, ErrorInfo>> => {
    if (!pendingOperation || pendingFiles.length === 0) {
      return err(createErrorInfo('INVALID_STATE', t('error.noOperationPending')))
    }

    for (const pendingFile of pendingFiles) {
      if (
        pendingFile.type === 'directory' &&
        isSubPath(pendingFile.absolutePath, targetDir.absolutePath)
      ) {
        const errorMessage =
          pendingOperation === FILE_OPERATIONS.COPY
            ? t('toast.cannotCopyToSelf')
            : t('toast.cannotMoveToSelf')
        return err(createErrorInfo('SELF_CONTAINED', errorMessage))
      }
    }

    const listResult = await window.electronAPI.protocol.list(sessionId, targetDir.absolutePath)

    if (isProtocolResponseErr(listResult)) {
      const msg = formatErrorMessage(listResult.error) || t('error.unknown')
      return err(createErrorInfo('LIST_FAILED', msg))
    }

    const targetFiles = listResult.value
    const existingFiles = new Map(targetFiles.map(f => [f.name, f]))
    setTargetFilesCache(new Map(targetFiles.map(f => [f.name, f.type])))

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
      isHandlingConflictRef.current = true
      setConflictDialogOpen(true)
      setTargetFolderDialogOpen(false)
      return ok(undefined)
    }

    await executeOperation(
      pendingFiles,
      targetDir,
      new Map(),
      new Map(targetFiles.map(f => [f.name, f.type]))
    )

    return ok(undefined)
  }

  const handleConflictResolution = async (
    resolutions: ConflictResolution[],
    operation?: CopyMoveOperation | null,
    files?: FileInfo[],
    targetDir?: FileInfo | null
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
      const resolutionsMap = new Map(resolutions.map(r => [r.sourceFile.absolutePath, r]))
      await executeOperation(pendingFilesList, pendingTargetDirValue, resolutionsMap, cache, op)
    } catch (error) {
      logger.catch(error, { action: op === FILE_OPERATIONS.COPY ? 'copy' : 'move' })
      const msg = formatErrorMessage(error) || t('error.unknown')
      if (op === FILE_OPERATIONS.COPY) {
        addToast({ type: TOAST_TYPE.ERROR, message: `${t('toast.copyFailed')}: ${msg}` })
      } else {
        addToast({ type: TOAST_TYPE.ERROR, message: `${t('toast.moveFailed')}: ${msg}` })
      }
    } finally {
      isHandlingConflictRef.current = false
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
