import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface FileExplorerFilterProps {
  value: string
  onChange: (value: string) => void
}

/** 当前目录过滤：只作用于已列出的条目，不触发远端查询。 */
export const FileExplorerFilter = ({ value, onChange }: FileExplorerFilterProps) => {
  const { t } = useTranslation()

  return (
    <div
      className={`
        relative shrink-0 w-44 h-8 rounded-md bg-bg-secondary transition-shadow
        focus-within:ring-2 focus-within:ring-ring
      `}
    >
      <Search className="w-3.5 h-3.5 stroke-text-muted stroke-2 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onChange('')
            e.currentTarget.blur()
          }
        }}
        placeholder={t(($) => $.fileExplorerList.filterPlaceholder)}
        aria-label={t(($) => $.fileExplorerList.filterPlaceholder)}
        data-testid="file-filter"
        className={`
          w-full h-full pl-7 pr-7 rounded-md border-none bg-transparent
          text-xs text-text placeholder:text-text-muted focus:shadow-none
        `}
      />
      {value !== '' && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t(($) => $.fileExplorerList.clearFilter)}
          className={`
            absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center
            border-none bg-transparent text-text-muted hover:text-text hover:bg-hover transition-colors
            focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
          `}
        >
          <X className="w-3 h-3 stroke-current stroke-2" />
        </button>
      )}
    </div>
  )
}

export default FileExplorerFilter
