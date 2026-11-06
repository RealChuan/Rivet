import { useTranslation } from 'react-i18next'
import ParentDirectoryButton from './ParentDirectoryButton.js'

interface FileExplorerStatusBarProps {
  currentPath: string
  onNavigate: () => void
  /** 已选条目数；框选进行中传实时覆盖数 */
  selectedCount: number
  /** 当前目录已列出的条目数（受 MAX_LIST_ENTRIES 截断） */
  totalCount: number
}

/** 底部状态条：左侧上级目录，右侧已选/总数。列表与宫格共用，高度固定，根目录只隐藏左侧按钮。 */
export const FileExplorerStatusBar = ({
  currentPath,
  onNavigate,
  selectedCount,
  totalCount,
}: FileExplorerStatusBarProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-t border-border shrink-0">
      <div className="flex items-center min-h-7 min-w-0">
        <ParentDirectoryButton currentPath={currentPath} onNavigate={onNavigate} />
      </div>
      <span
        data-testid="file-explorer-count"
        className="ml-auto text-xs text-text-muted tabular-nums whitespace-nowrap"
      >
        {selectedCount > 0
          ? t(($) => $.fileExplorerList.selectedCount, { count: selectedCount, total: totalCount })
          : t(($) => $.fileExplorerList.totalCount, { count: totalCount })}
      </span>
    </div>
  )
}

export default FileExplorerStatusBar
