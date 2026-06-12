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

import { Minus, Square, Maximize2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import logger from '@renderer/utils/logger.js'
import { AppLogo } from './AppLogo.js'

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
  /**
   * 自定义关闭按钮处理（可用于活跃任务守卫）
   * 不传则直接调用 window.electronAPI.window.close()
   */
  onClose?: () => void
}

// ============================================================
// 组件实现
// ============================================================

export function TitleBar({
  childMode = false,
  centerContent,
  leftContent,
  title,
  onClose,
}: TitleBarProps) {
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
    if (onClose) {
      onClose()
    } else {
      window.electronAPI.window.close()
    }
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
              className="w-8 h-6 flex items-center justify-center text-text-muted hover:bg-hover hover:text-text transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-default"
              aria-label={t('titleBar.minimize')}
              title={t('titleBar.minimize')}
              type="button"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleMaximize}
              className="w-8 h-6 flex items-center justify-center text-text-muted hover:bg-hover hover:text-text transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-default"
              aria-label={isMaximized ? t('titleBar.restore') : t('titleBar.maximize')}
              title={isMaximized ? t('titleBar.restore') : t('titleBar.maximize')}
              type="button"
            >
              {isMaximized ? <Maximize2 className="w-3 h-3" /> : <Square className="w-3 h-3" />}
            </button>
          </>
        )}

        <button
          onClick={handleClose}
          className="w-8 h-6 flex items-center justify-center text-text-muted hover:bg-danger hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-default"
          aria-label={t('titleBar.close')}
          title={t('titleBar.close')}
          type="button"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  )
}

export default TitleBar
