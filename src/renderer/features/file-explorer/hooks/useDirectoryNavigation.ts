import { type FileInfo } from '@shared/types/index.js'
import { getParentPath } from '@shared/utils/index.js'

export const useDirectoryNavigation = (
  sessionId: string,
  currentPath: string,
  updateCurrentPath: (sessionId: string, path: string) => void,
  refreshCurrentDirectory: (sessionId: string) => Promise<void>,
  onNavigateComplete?: () => void
) => {
  const handleNavigate = async (path: string) => {
    updateCurrentPath(sessionId, path)
    onNavigateComplete?.()
    await refreshCurrentDirectory(sessionId)
  }

  const handleDoubleClick = (file: FileInfo) => {
    if (file.type === 'directory') {
      void handleNavigate(file.absolutePath)
    }
  }

  const handleParentDirectory = () => {
    if (currentPath === '/') return
    void handleNavigate(getParentPath(currentPath))
  }

  return {
    handleNavigate,
    handleDoubleClick,
    handleParentDirectory,
  }
}

export default useDirectoryNavigation
