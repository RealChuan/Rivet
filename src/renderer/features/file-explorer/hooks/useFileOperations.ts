import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@renderer/features/session/stores/sessionStore.js'
import { useUiStore } from '@renderer/stores/index.js'
import { logger } from '@renderer/utils/index.js'
import { type FileInfo } from '@shared/types/index.js'
import {
  type ConflictItem,
  type ConflictResolution,
} from '@renderer/features/file-explorer/components/ConflictDialog.js'
import { isSubPath, generateUniqueName, toErrorMessage } from '@shared/utils/index.js'
import { FileOperation } from '@shared/constants/index.js'

type CopyMoveOperation = typeof FileOperation.COPY | typeof FileOperation.MOVE

interface UseFileOperationsReturn {
  handleDelete: (files: FileInfo[]) => Promise<void>
  handleRename: (file: FileInfo, newName: string) => Promise<void>
  handleCreateFolder: (currentPath: string, folderName: string) => Promise<void>
  handleCopy: (files: FileInfo[]) => void
  handleMove: (files: FileInfo[]) => void
  handleSelectTargetFolder: (targetDir: FileInfo) => Promise<void>
  handleConflictResolution: (
    resolutions: ConflictResolution[],
    operation?: CopyMoveOperation,
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

export const useFileOperations = (sessionId: string): UseFileOperationsReturn => {
  const { t } = useTranslation()
  const { refreshCurrentDirectory } = useSessionStore()
  const { addToast } = useUiStore()

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

  const handleDelete = useCallback(
    async (files: FileInfo[]) => {
      if (files.length === 0) return
      try {
        for (const file of files) {
          await window.electronAPI.protocol.delete(sessionId, file)
        }
        addToast({ type: 'success', message: t('toast.deleteSuccess') })
        await refreshCurrentDirectory(sessionId)
      } catch (error) {
        const errorMsg = toErrorMessage(error) || 'Unknown error'
        addToast({
          type: 'error',
          message: `${t('toast.deleteFailed')}: ${errorMsg}`,
        })
      }
    },
    [sessionId, addToast, t, refreshCurrentDirectory]
  )

  const handleRename = useCallback(
    async (file: FileInfo, newName: string) => {
      try {
        await window.electronAPI.protocol.rename(sessionId, file, newName)
        addToast({ type: 'success', message: t('toast.renameSuccess') })
        await refreshCurrentDirectory(sessionId)
      } catch (error) {
        addToast({
          type: 'error',
          message: `${t('toast.renameFailed')}: ${toErrorMessage(error) || 'Unknown error'}`,
        })
      }
    },
    [sessionId, addToast, t, refreshCurrentDirectory]
  )

  const handleCreateFolder = useCallback(
    async (currentPath: string, folderName: string) => {
      const newFolderPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`

      try {
        await window.electronAPI.protocol.mkdir(sessionId, newFolderPath)
        addToast({ type: 'success', message: t('toast.createFolderSuccess') })
        await refreshCurrentDirectory(sessionId)
      } catch (error) {
        addToast({
          type: 'error',
          message: `${t('toast.createFolderFailed')}: ${toErrorMessage(error) || 'Unknown error'}`,
        })
      }
    },
    [sessionId, addToast, t, refreshCurrentDirectory]
  )

  const handleCopy = useCallback((files: FileInfo[]) => {
    setPendingFiles(files)
    setPendingOperation(FileOperation.COPY)
    setTargetFolderDialogOpen(true)
  }, [])

  const handleMove = useCallback((files: FileInfo[]) => {
    setPendingFiles(files)
    setPendingOperation(FileOperation.MOVE)
    setTargetFolderDialogOpen(true)
  }, [])

  const getTargetPath = (fileName: string, targetDir: string): string => {
    return targetDir === '/' ? `/${fileName}` : `${targetDir}/${fileName}`
  }

  const executeOperation = useCallback(
    async (
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
            const uniqueName = generateUniqueName(file.name, existingNamesSet)
            targetPath = getTargetPath(uniqueName, targetDir.absolutePath)
            existingNamesSet.add(uniqueName)
          }
        } else if (existingNamesSet.has(file.name)) {
          const uniqueName = generateUniqueName(file.name, existingNamesSet)
          targetPath = getTargetPath(uniqueName, targetDir.absolutePath)
          existingNamesSet.add(uniqueName)
        }

        if (!shouldProcess) continue

        itemsToProcess.push({ file, targetPath })
      }

      logger.info(`[${op?.toUpperCase() ?? 'Unknown'}] Processing ${itemsToProcess.length} items`)

      for (const { file, targetPath } of itemsToProcess) {
        if (op === FileOperation.COPY) {
          await window.electronAPI.protocol.copy(sessionId, file, targetPath)
        } else {
          await window.electronAPI.protocol.move(sessionId, file, targetPath)
        }
      }

      if (op === FileOperation.COPY) {
        addToast({ type: 'success', message: t('toast.copySuccess') })
      } else {
        addToast({ type: 'success', message: t('toast.moveSuccess') })
      }

      await refreshCurrentDirectory(sessionId)
    },
    [sessionId, pendingOperation, addToast, t, refreshCurrentDirectory]
  )

  const handleSelectTargetFolder = useCallback(
    async (targetDir: FileInfo) => {
      if (!pendingOperation || pendingFiles.length === 0) return

      try {
        for (const pendingFile of pendingFiles) {
          if (
            pendingFile.type === 'directory' &&
            isSubPath(pendingFile.absolutePath, targetDir.absolutePath)
          ) {
            throw new Error(t('toast.cannotMoveToSelf'))
          }
        }

        const targetFiles = (await window.electronAPI.protocol.list(
          sessionId,
          targetDir.absolutePath
        )) as FileInfo[]
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
          return
        }

        await executeOperation(
          pendingFiles,
          targetDir,
          new Map(),
          new Map(targetFiles.map(f => [f.name, f.type]))
        )
      } catch (error) {
        const msg = toErrorMessage(error) || 'Unknown error'
        if (pendingOperation === FileOperation.COPY) {
          addToast({ type: 'error', message: `${t('toast.copyFailed')}: ${msg}` })
        } else {
          addToast({ type: 'error', message: `${t('toast.moveFailed')}: ${msg}` })
        }
        setTargetFolderDialogOpen(false)
        setPendingOperation(null)
        setPendingFiles([])
        setTargetFilesCache(new Map())
      }
    },
    [sessionId, pendingOperation, pendingFiles, t, addToast, executeOperation]
  )

  const handleConflictResolution = useCallback(
    async (
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
        const msg = toErrorMessage(error) || 'Unknown error'
        if (op === FileOperation.COPY) {
          addToast({ type: 'error', message: `${t('toast.copyFailed')}: ${msg}` })
        } else {
          addToast({ type: 'error', message: `${t('toast.moveFailed')}: ${msg}` })
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
    },
    [
      pendingOperation,
      pendingFiles,
      pendingTargetDir,
      targetFilesCache,
      t,
      addToast,
      executeOperation,
    ]
  )

  return {
    handleDelete,
    handleRename,
    handleCreateFolder,
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

export default useFileOperations
