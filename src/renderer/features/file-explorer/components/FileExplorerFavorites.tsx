import { Bookmark, Star, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClickOutside } from '../../../hooks/index.js'
import { useConnectionFavorites, useNavigateToDirectory } from '../hooks/index.js'

interface FileExplorerFavoritesProps {
  sessionId: string
}

/** 收藏入口：只负责列出与跳转；收藏/取消收藏在右键菜单里完成。 */
export const FileExplorerFavorites = ({ sessionId }: FileExplorerFavoritesProps) => {
  const { t } = useTranslation()
  const { paths, toggleFavorite } = useConnectionFavorites(sessionId)
  const { navigate } = useNavigateToDirectory(sessionId)

  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useClickOutside({
    ref: popoverRef,
    enabled: open,
    event: 'click',
    onOutside: () => setOpen(false),
  })

  return (
    <div ref={popoverRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((prev) => !prev)}
        title={t(($) => $.favorites.title)}
        aria-label={t(($) => $.favorites.title)}
        aria-expanded={open}
        data-testid="favorite-menu"
        className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center border-none bg-transparent text-text-muted hover:text-text hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
      >
        <Bookmark className="w-3.5 h-3.5 stroke-current stroke-2" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-glass-bg rounded-lg shadow-dropdown border border-glass-border p-1.5 min-w-72 z-1000 animate-menu-in">
          {paths.length === 0 ? (
            <div className="px-2.5 py-2">
              <div className="text-sm text-text">{t(($) => $.favorites.empty)}</div>
              <div className="mt-1 text-xs text-text-muted flex items-start gap-1.5">
                <Star className="w-3.5 h-3.5 stroke-current stroke-2 shrink-0 mt-0.5" />
                {t(($) => $.favorites.hint)}
              </div>
            </div>
          ) : (
            paths.map((path) => (
              <div key={path} className="flex items-center gap-1">
                <button
                  onClick={() => {
                    void navigate(path).then((ok) => {
                      if (ok) setOpen(false)
                    })
                  }}
                  title={path}
                  data-testid="favorite-item"
                  className="flex-1 min-w-0 px-2.5 py-2 text-left text-sm text-text bg-transparent border-none rounded-md hover:bg-hover transition-colors truncate focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
                >
                  {path}
                </button>
                <button
                  onClick={() => toggleFavorite(path)}
                  title={t(($) => $.favorites.remove)}
                  aria-label={t(($) => $.favorites.remove)}
                  className="p-1.5 rounded-md bg-transparent border-none text-text-muted hover:text-danger hover:bg-danger-light transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 shrink-0"
                >
                  <X className="w-3.5 h-3.5 stroke-current stroke-2" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default FileExplorerFavorites
