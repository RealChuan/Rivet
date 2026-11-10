import { Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { normalizePath } from '@shared/utils/index.js'
import { useUiStore } from '../../../stores/index.js'
import { cn } from '../../../utils/index.js'
import { useSessionStore } from '../../session/stores/session.js'
import { useDirectoryInvalidation, useNavigateToDirectory } from '../hooks/index.js'
import FileExplorerBreadcrumb from './FileExplorerBreadcrumb.js'
import FileExplorerFavorites from './FileExplorerFavorites.js'

interface FileExplorerAddressBarProps {
  sessionId: string
  currentPath: string
}

/** 绝对路径校验：只允许当前连接内的绝对路径，拒绝遍历段。 */
function validatePath(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const normalized = normalizePath(trimmed)
  if (!normalized.startsWith('/')) return null
  if (normalized.split('/').includes('..')) return null
  return normalized
}

/**
 * 路径栏：面包屑/输入框与该行的操作（编辑路径、收藏）共用同一个容器，
 * 边框与底色跟着编辑态切换，避免路径和右侧按钮看起来像两套控件。
 */
export const FileExplorerAddressBar = ({ sessionId, currentPath }: FileExplorerAddressBarProps) => {
  const { t } = useTranslation()
  const editing = useUiStore((state) => state.addressEditingSessionId === sessionId)
  const setAddressEditing = useUiStore((state) => state.setAddressEditing)
  const addToast = useUiStore((state) => state.addToast)
  const updateCurrentPath = useSessionStore((state) => state.updateCurrentPath)
  const { markSessionStale } = useDirectoryInvalidation()
  const { navigate } = useNavigateToDirectory(sessionId)

  // null 表示还没改过：显示当前路径，避免用 effect 把 currentPath 同步进 state。
  const [draft, setDraft] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  /** 面包屑的每一段都是当前目录的祖先，必然存在，不需要再 stat。 */
  const goToKnownPath = (path: string) => {
    updateCurrentPath(sessionId, path)
    void markSessionStale(sessionId)
  }

  const close = () => {
    setDraft(null)
    setAddressEditing(null)
  }

  const submit = async () => {
    if (isChecking) return
    const target = validatePath(draft ?? currentPath)
    if (target === null) {
      addToast({ type: TOAST_TYPE.ERROR, message: t(($) => $.fileExplorerList.invalidAddress) })
      return
    }
    if (target === normalizePath(currentPath)) {
      close()
      return
    }

    setIsChecking(true)
    try {
      if (await navigate(target)) close()
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 flex-1 min-w-0 h-8 pl-1 pr-0.5 rounded-md transition-shadow',
        editing ? 'bg-surface ring-2 ring-ring' : 'bg-bg-secondary',
      )}
    >
      {editing ? (
        <form
          className="flex-1 min-w-0 h-full"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <input
            ref={inputRef}
            value={draft ?? currentPath}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                close()
              }
            }}
            onBlur={close}
            aria-busy={isChecking}
            aria-label={t(($) => $.fileExplorerList.editAddress)}
            data-testid="address-input"
            spellCheck={false}
            className="w-full h-full px-1.5 rounded-md border-none bg-transparent text-xs font-mono text-text focus:shadow-none"
          />
        </form>
      ) : (
        <>
          <FileExplorerBreadcrumb
            path={currentPath}
            sessionId={sessionId}
            onNavigate={goToKnownPath}
          />
          <button
            type="button"
            onClick={() => setAddressEditing(sessionId)}
            title={`${t(($) => $.fileExplorerList.editAddress)} (Ctrl+L)`}
            aria-label={t(($) => $.fileExplorerList.editAddress)}
            data-testid="edit-address"
            className={`
              shrink-0 w-6 h-6 rounded-md flex items-center justify-center border-none bg-transparent
              text-text-muted hover:text-text hover:bg-hover transition-colors
              focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
            `}
          >
            <Pencil className="w-3.5 h-3.5 stroke-current stroke-2" />
          </button>
          <FileExplorerFavorites sessionId={sessionId} />
        </>
      )}
    </div>
  )
}

export default FileExplorerAddressBar
