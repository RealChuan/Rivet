/**
 * TitleBar — 跨平台无边框窗口标题栏
 *
 * 特性：
 * - 自动识别平台（macOS / Windows / Linux）
 * - macOS: 仅显示占位条，系统交通灯自动渲染
 * - Windows/Linux: 完整自定义按钮（最小化/最大化/关闭）
 * - 支持 childMode: 子窗口隐藏最大化按钮，仅显示关闭
 * - 支持自定义中间内容和左侧内容
 * - 支持主题切换（通过 CSS 变量）
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import logger from '@renderer/utils/logger.js'

// ============================================================
// 内联 SVG 图标（零外部依赖）
// ============================================================

const IconMinus = ({ className }: { className?: string }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    className={className}
  >
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const IconSquare = ({ className }: { className?: string }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
)

const IconMaximize2 = ({ className }: { className?: string }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    className={className}
  >
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
)

const IconX = ({ className }: { className?: string }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    className={className}
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// ============================================================
// Props 定义
// ============================================================

export interface TitleBarProps {
  /**
   * 子窗口模式
   * - true: 隐藏最小化/最大化，仅显示关闭按钮
   * - false: 显示完整窗口控制按钮
   */
  childMode?: boolean
  /**
   * 标题栏中间区域自定义内容
   * 例如：标签页、面包屑、搜索框
   */
  centerContent?: React.ReactNode
  /**
   * 标题栏左侧额外内容（在 Logo/标题之后）
   */
  leftContent?: React.ReactNode
  /**
   * 自定义标题文字
   */
  title?: string
}

// ============================================================
// 组件实现
// ============================================================

const AppLogo = () => (
  <div
    className="w-5 h-5 rounded-md flex items-center justify-center"
    style={{ background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' }}
  >
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  </div>
)

export function TitleBar({ childMode = false, centerContent, leftContent, title }: TitleBarProps) {
  const { t } = useTranslation()
  const [isMaximized, setIsMaximized] = useState(false)
  const [platform, setPlatform] = useState<string>('win32')

  // 初始化窗口状态 + 订阅变化
  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const init = async () => {
      try {
        const state = await window.electronAPI.window.getState()
        if (state) {
          const isMaximized = typeof state.isMaximized === 'boolean' ? state.isMaximized : false
          const platform = typeof state.platform === 'string' ? state.platform : 'win32'
          setIsMaximized(isMaximized)
          setPlatform(platform)
        }

        unsubscribe = window.electronAPI.window.onStateChange(
          (newState: { isMaximized: boolean }) => {
            setIsMaximized(newState.isMaximized)
          }
        )
      } catch (err) {
        logger.catch(err, { action: 'initialize-window-state' })
      }
    }

    void init()
    return () => unsubscribe?.()
  }, [])

  const handleMinimize = () => {
    window.electronAPI.window.minimize()
  }

  const handleMaximize = () => {
    window.electronAPI.window.maximize()
  }

  const handleClose = () => {
    window.electronAPI.window.close()
  }

  const isMac = platform === 'darwin'

  // ==================== macOS 标题栏 ====================
  if (isMac) {
    return (
      <header
        className="h-9 bg-bg border-b border-border flex items-center justify-center draggable titlebar-text shrink-0"
        data-testid="titlebar-macos"
      >
        <span className="text-xs text-text-muted font-medium tracking-wide">{title}</span>
      </header>
    )
  }

  // ==================== Windows / Linux 标题栏 ====================
  return (
    <header
      className="h-9 bg-bg border-b border-border flex items-center justify-between shrink-0"
      data-testid="titlebar-win32"
    >
      {/* 左侧：拖拽区 + 应用标识（双击可最大化） */}
      <div
        className="flex-1 flex items-center h-full px-3 draggable titlebar-text"
        onDoubleClick={childMode ? undefined : handleMaximize}
        role="button"
        aria-label={t('titleBar.dragToMove')}
      >
        <div className="flex items-center gap-2 no-drag">
          {/* 应用 Logo */}
          <AppLogo />
          <div className="flex items-center gap-3">
            <span className="text-sm text-text font-semibold">{t('app.name')}</span>
            <span className="text-xs text-text-muted">{t('app.subtitle')}</span>
          </div>
          {leftContent}
        </div>
      </div>

      {/* 右侧：功能按钮 + 系统控制按钮 */}
      <div className="flex h-full items-center gap-1 px-2 no-drag">
        {centerContent}

        {/* 分隔线 */}
        {centerContent && !childMode && <div className="w-px h-4 bg-border mx-1" />}

        {/* 窗口控制按钮 */}
        {!childMode && (
          <>
            <button
              onClick={handleMinimize}
              className="w-8 h-6 flex items-center justify-center text-text-muted hover:bg-hover hover:text-text transition-colors duration-150 focus:outline-none cursor-default"
              aria-label={t('titleBar.minimize')}
              title={t('titleBar.minimize')}
              type="button"
            >
              <IconMinus />
            </button>

            <button
              onClick={handleMaximize}
              className="w-8 h-6 flex items-center justify-center text-text-muted hover:bg-hover hover:text-text transition-colors duration-150 focus:outline-none cursor-default"
              aria-label={isMaximized ? t('titleBar.restore') : t('titleBar.maximize')}
              title={isMaximized ? t('titleBar.restore') : t('titleBar.maximize')}
              type="button"
            >
              {isMaximized ? <IconMaximize2 /> : <IconSquare />}
            </button>
          </>
        )}

        <button
          onClick={handleClose}
          className="w-8 h-6 flex items-center justify-center text-text-muted hover:bg-danger hover:text-white transition-colors duration-150 focus:outline-none cursor-default"
          aria-label={t('titleBar.close')}
          title={t('titleBar.close')}
          type="button"
        >
          <IconX />
        </button>
      </div>
    </header>
  )
}

export default TitleBar
