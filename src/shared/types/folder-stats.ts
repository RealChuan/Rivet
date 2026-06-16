export interface FolderStatsProgress {
  fileCount: number
  folderCount: number
  totalSize: number
  currentPath: string
  isComplete: boolean
  isCancelled: boolean
  errorCount: number
}
