import { FILE_TYPE, ROOT_PATH } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
import { getParentPath } from '@shared/utils/index.js'

export const useDirectoryNavigation = (
  sessionId: string,
  currentPath: string,
  updateCurrentPath: (sessionId: string, path: string) => void,
  refreshCurrentDirectory: (sessionId: string) => Promise<void>,
  onNavigateComplete?: () => void,
) => {
  const handleNavigate = async (path: string) => {
    updateCurrentPath(sessionId, path)
    onNavigateComplete?.()
    await refreshCurrentDirectory(sessionId)
  }

  const handleDoubleClick = (file: FileInfo) => {
    if (file.type === FILE_TYPE.DIRECTORY) {
      void handleNavigate(file.absolutePath)
    }
  }

  const handleParentDirectory = () => {
    if (currentPath === ROOT_PATH) return
    void handleNavigate(getParentPath(currentPath))
  }

  return {
    handleNavigate,
    handleDoubleClick,
    handleParentDirectory,
  }
}

export default useDirectoryNavigation
