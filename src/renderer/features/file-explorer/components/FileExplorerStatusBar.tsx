import { useTranslation } from 'react-i18next'
import { formatFileSize } from '@shared/utils/index.js'
import ParentDirectoryButton from './ParentDirectoryButton.js'

interface FileExplorerStatusBarProps {
  currentPath: string
  onNavigate: () => void
  /** 已选条目数；框选进行中传实时覆盖数 */
  selectedCount: number
  /** 已选文件的总字节数；文件夹不计入 */
  selectedSize: number
  /** 已选文件夹数量；不做递归统计 */
  selectedFolderCount: number
  /** 过滤后可见条目数 */
  visibleCount: number
  /** 当前目录已列出的条目数（受列举上限截断） */
  listedCount: number
  isFiltering: boolean
}

/** 底部状态条：左侧上级目录，右侧已选/匹配/总数。列表与宫格共用，高度固定，根目录只隐藏左侧按钮。 */
export const FileExplorerStatusBar = ({
  currentPath,
  onNavigate,
  selectedCount,
  selectedSize,
  selectedFolderCount,
  visibleCount,
  listedCount,
  isFiltering,
}: FileExplorerStatusBarProps) => {
  const { t, i18n } = useTranslation()

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-t border-border shrink-0">
      <div className="flex items-center min-h-7 min-w-0">
        <ParentDirectoryButton currentPath={currentPath} onNavigate={onNavigate} />
      </div>
      <span
        data-testid="file-explorer-count"
        className="ml-auto text-xs text-text-muted tabular-nums whitespace-nowrap"
      >
        {selectedCount > 0 ? (
          <>
            {t(($) => $.fileExplorerList.selectedCount, {
              count: selectedCount,
              total: visibleCount,
            })}
            {selectedSize > 0 && <> · {formatFileSize(selectedSize, i18n.language)}</>}
            {selectedFolderCount > 0 && (
              <>
                {' · '}
                {t(($) => $.fileExplorerList.selectedFolders, { count: selectedFolderCount })}
              </>
            )}
          </>
        ) : isFiltering ? (
          t(($) => $.fileExplorerList.filteredCount, {
            count: visibleCount,
            total: listedCount,
          })
        ) : (
          t(($) => $.fileExplorerList.totalCount, { count: listedCount })
        )}
      </span>
    </div>
  )
}

export default FileExplorerStatusBar
