import { Home, ChevronRight } from 'lucide-react'
import { Fragment, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ROOT_PATH } from '@shared/constants/index.js'
import { cn } from '../../../utils/index.js'
import { useSessionStore } from '../../session/stores/session.js'

interface FileExplorerBreadcrumbProps {
  path: string
  sessionId: string
  onNavigate?: (path: string) => void
}

export const FileExplorerBreadcrumb = ({
  path,
  sessionId,
  onNavigate,
}: FileExplorerBreadcrumbProps) => {
  const { t } = useTranslation()
  const updateCurrentPath = useSessionStore((state) => state.updateCurrentPath)
  const navRef = useRef<HTMLElement>(null)

  const pathParts = path.split('/').filter(Boolean)

  // 目录层级多时横向滚动查看祖先，滚动条本身压扁成细条，避免在 32px 的路径栏里抢空间。
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    nav.scrollLeft = nav.scrollWidth
  }, [path])

  const handleNavigate = (targetPath: string) => {
    if (onNavigate) {
      onNavigate(targetPath)
      return
    }
    updateCurrentPath(sessionId, targetPath)
  }

  return (
    <nav
      ref={navRef}
      onWheel={(e) => {
        const nav = e.currentTarget
        if (e.deltaY === 0 || nav.scrollWidth <= nav.clientWidth) return
        nav.scrollLeft += e.deltaY
      }}
      className={`
        flex items-center gap-0.5 flex-1 min-w-0 h-full px-0.5 overflow-x-auto
        [&::-webkit-scrollbar]:h-1
        [&::-webkit-scrollbar-thumb]:bg-text-muted/25
      `}
    >
      <button
        type="button"
        onClick={() => void handleNavigate(ROOT_PATH)}
        title={t(($) => $.fileExplorerList.parentDirectory)}
        aria-label={t(($) => $.fileExplorerList.parentDirectory)}
        className={`
          shrink-0 w-6 h-6 rounded-md flex items-center justify-center border-none bg-transparent
          text-text-muted hover:text-text hover:bg-hover transition-colors
          focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
        `}
      >
        <Home className="w-3.5 h-3.5 stroke-current stroke-2" />
      </button>
      {pathParts.map((part, index) => {
        const fullPath = '/' + pathParts.slice(0, index + 1).join('/')
        const isLast = index === pathParts.length - 1

        return (
          <Fragment key={fullPath}>
            <ChevronRight className="w-3 h-3 stroke-text-muted stroke-2 shrink-0 opacity-60" />
            <button
              type="button"
              onClick={() => void handleNavigate(fullPath)}
              title={fullPath}
              aria-current={isLast ? 'page' : undefined}
              className={cn(
                'shrink-0 h-6 px-1.5 rounded-md border-none bg-transparent text-xs whitespace-nowrap transition-colors',
                'focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2',
                isLast ? 'text-text font-medium' : 'text-text-muted hover:bg-hover hover:text-text',
              )}
            >
              <span className="block max-w-40 truncate">{part}</span>
            </button>
          </Fragment>
        )
      })}
    </nav>
  )
}

export default FileExplorerBreadcrumb
