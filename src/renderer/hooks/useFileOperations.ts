import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../stores/sessionStore'
import { useUiStore } from '../stores/uiStore'
import { useTransferQueue } from './useTransferQueue'
import logger from '../utils/logger'
import { FileInfo } from '@shared/types'
import { ConflictItem, ConflictResolution } from '../components/dialogs/ConflictDialog'
import { isSubPath, generateUniqueName } from '../utils/utils'

interface UseFileOperationsReturn {
  handleDelete: (files: FileInfo[]) => void
  handleRename: (file: FileInfo, newName: string) => Promise<void>
  handleCreateFolder: (currentPath: string, folderName: string) => Promise<void>
  handleDownload: (file: FileInfo) => Promise<void>
  handleCopy: (files: FileInfo[]) => void
  handleMove: (files: FileInfo[]) => void
  handleSelectTargetFolder: (targetDir: FileInfo) => Promise<void>
  handleConflictResolution: (
    resolutions: ConflictResolution[],
    operation?: 'copy' | 'move',
    files?: FileInfo[],
    targetDir?: FileInfo | null
  ) => Promise<void>
  targetFolderDialogOpen: boolean
  conflictDialogOpen: boolean
  conflicts: ConflictItem[]
  pendingOperation: 'copy' | 'move' | null | undefined
  pendingFiles: FileInfo[]
  pendingTargetDir: FileInfo | null | undefined
  setTargetFolderDialogOpen: (open: boolean) => void
  setConflictDialogOpen: (open: boolean) => void
}

export const useFileOperations = (sessionId: string): UseFileOperationsReturn => {
  const { t } = useTranslation()
  const { refreshCurrentDirectory } = useSessionStore()
  const { addToast } = useUiStore()
  const { download } = useTransferQueue()

  const [targetFolderDialogOpen, setTargetFolderDialogOpen] = useState(false)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [pendingOperation, setPendingOperation] = useState<'copy' | 'move' | null>(null)
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
        await window.electronAPI.delete(sessionId, files)
        addToast({ type: 'success', message: t('toast.deleteSuccess') })
        await refreshCurrentDirectory(sessionId)
      } catch (error) {
        addToast({
          type: 'error',
          message: `${t('toast.deleteFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }
    },
    [sessionId, addToast, t, refreshCurrentDirectory]
  )

  const handleRename = useCallback(
    async (file: FileInfo, newName: string) => {
      try {
        await window.electronAPI.rename(sessionId, file, newName)
        addToast({ type: 'success', message: t('toast.renameSuccess') })
        await refreshCurrentDirectory(sessionId)
      } catch (error) {
        addToast({
          type: 'error',
          message: `${t('toast.renameFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }
    },
    [sessionId, addToast, t, refreshCurrentDirectory]
  )

  const handleCreateFolder = useCallback(
    async (currentPath: string, folderName: string) => {
      const newFolderPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`

      try {
        await window.electronAPI.mkdir(sessionId, newFolderPath)
        addToast({ type: 'success', message: t('toast.createFolderSuccess') })
        await refreshCurrentDirectory(sessionId)
      } catch (error) {
        addToast({
          type: 'error',
          message: `${t('toast.createFolderFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }
    },
    [sessionId, addToast, t, refreshCurrentDirectory]
  )

  const handleDownload = useCallback(
    async (file: FileInfo) => {
      if (file.type === 'directory') return
      try {
        const result = await window.electronAPI.showSaveDialog({
          defaultPath: file.name,
        })
        if (result && !result.canceled && result.filePath) {
          await download(file, result.filePath)
        }
      } catch (error) {
        addToast({
          type: 'error',
          message: `${t('toast.downloadFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }
    },
    [addToast, t, download]
  )

  const handleCopy = useCallback((files: FileInfo[]) => {
    setPendingFiles(files)
    setPendingOperation('copy')
    setTargetFolderDialogOpen(true)
  }, [])

  const handleMove = useCallback((files: FileInfo[]) => {
    setPendingFiles(files)
    setPendingOperation('move')
    setTargetFolderDialogOpen(true)
  }, [])

  const getTargetPath = (fileName: string, targetDir: string): string => {
    return targetDir === '/' ? `/${fileName}` : `${targetDir}/${fileName}`
  }

  const copyDirectory = useCallback(
    async (file: FileInfo, targetPath: string) => {
      await window.electronAPI.mkdir(sessionId, targetPath)
      const sourceFiles = await window.electronAPI.list(sessionId, file.absolutePath)

      const childFilesToCopy: FileInfo[] = []
      const childDirectoriesToCopy: Array<{ file: FileInfo; childTargetPath: string }> = []

      for (const childFile of sourceFiles) {
        const childTargetPath =
          targetPath === '/' ? `/${childFile.name}` : `${targetPath}/${childFile.name}`

        if (childFile.type === 'directory') {
          childDirectoriesToCopy.push({ file: childFile, childTargetPath })
        } else {
          childFilesToCopy.push(childFile)
        }
      }

      if (childFilesToCopy.length > 0) {
        for (const childFile of childFilesToCopy) {
          const childTargetPath =
            targetPath === '/' ? `/${childFile.name}` : `${targetPath}/${childFile.name}`
          await window.electronAPI.copy(sessionId, childFile, childTargetPath)
        }
      }

      for (const { file: childDir, childTargetPath } of childDirectoriesToCopy) {
        await copyDirectory(childDir, childTargetPath)
      }
    },
    [sessionId]
  )

  const executeOperation = useCallback(
    async (
      files: FileInfo[],
      targetDir: FileInfo,
      resolutionsMap: Map<string, ConflictResolution>,
      existingNames?: Map<string, 'file' | 'directory'>,
      operation?: 'copy' | 'move'
    ) => {
      const op = operation || pendingOperation
      const targetFilesMap = existingNames || new Map()
      const existingNamesSet = new Set(targetFilesMap.keys())

      const filesToCopy: Array<{ file: FileInfo; targetPath: string }> = []
      const filesToMove: Array<{ file: FileInfo; targetPath: string }> = []
      const directoriesToCopy: Array<{ file: FileInfo; targetPath: string }> = []

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

        if (op === 'copy') {
          if (file.type === 'directory') {
            directoriesToCopy.push({ file, targetPath })
          } else {
            filesToCopy.push({ file, targetPath })
          }
        } else {
          filesToMove.push({ file, targetPath })
        }
      }

      if (op === 'copy') {
        logger.info(
          `[Copy] Copying ${filesToCopy.length} files, ${directoriesToCopy.length} directories`
        )
        for (const { file, targetPath } of filesToCopy) {
          await window.electronAPI.copy(sessionId, file, targetPath)
        }
        for (const { file, targetPath } of directoriesToCopy) {
          await copyDirectory(file, targetPath)
        }
      } else {
        for (const { file, targetPath } of filesToMove) {
          await window.electronAPI.move(sessionId, file, targetPath)
        }
      }

      if (op === 'copy') {
        addToast({ type: 'success', message: t('toast.copySuccess') })
      } else {
        addToast({ type: 'success', message: t('toast.moveSuccess') })
      }

      await refreshCurrentDirectory(sessionId)
    },
    [sessionId, pendingOperation, addToast, t, refreshCurrentDirectory, copyDirectory]
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

        const targetFiles = await window.electronAPI.list(sessionId, targetDir.absolutePath)
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
        const msg = error instanceof Error ? error.message : 'Unknown error'
        if (pendingOperation === 'copy') {
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
      operation?: 'copy' | 'move' | null | undefined,
      files?: FileInfo[],
      targetDir?: FileInfo | null
    ) => {
      const op = operation || pendingOperation
      const pendingFilesList = files || pendingFiles
      const pendingTargetDirValue = targetDir || pendingTargetDir
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
        const msg = error instanceof Error ? error.message : 'Unknown error'
        if (op === 'copy') {
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
    handleDownload,
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
