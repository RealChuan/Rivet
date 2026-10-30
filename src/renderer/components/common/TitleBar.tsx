import { Copy, Minus, Monitor, Moon, Square, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  SUPPORTED_LANGUAGE,
  THEME,
  type SupportedLanguageLiteral,
  type Theme,
} from '@shared/constants/index.js'
import { getWindowChrome } from '../../api/env.js'
import { windowApi } from '../../api/window.js'
import { cn } from '../../utils/index.js'
import { AppLogo } from './AppLogo.js'

interface TitleBarProps {
  title?: string
  subtitle?: string
  theme: Theme
  onCycleTheme: () => void
  language: SupportedLanguageLiteral
  onChangeLanguage: (language: SupportedLanguageLiteral) => void
}

/**
 * WCO / macOS hidden titlebar / Win10+Linux 自绘标题栏共用。
 * Win11 的 caption 按钮由系统 overlay 绘制，custom 模式才渲染右侧按钮。
 */
export function TitleBar({
  title,
  subtitle,
  theme,
  onCycleTheme,
  language,
  onChangeLanguage,
}: TitleBarProps) {
  const { t } = useTranslation()
  const windowChrome = getWindowChrome()
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (windowChrome !== 'custom') return
    void windowApi.getState().then((state) => setIsMaximized(state.isMaximized))
    return windowApi.onStateChanged((state) => setIsMaximized(state.isMaximized))
  }, [windowChrome])

  const isWco = windowChrome === 'wco'
  const isCustom = windowChrome === 'custom'
  // WCO 的 caption 区由系统不透明填充，Web 侧须同色实心；边框进不了 overlay 区，故不加。
  const surfaceClassName = isWco ? 'bg-titlebar' : 'border-b border-border'
  const themeLabel =
    theme === THEME.LIGHT
      ? t(($) => $.mainLayout.lightMode)
      : theme === THEME.DARK
        ? t(($) => $.mainLayout.darkMode)
        : t(($) => $.mainLayout.system)

  return (
    <header
      data-testid="titlebar"
      data-chrome={windowChrome}
      aria-label={t(($) => $.titleBar.dragToMove)}
      onDoubleClick={isCustom ? () => windowApi.toggleMaximize() : undefined}
      className={cn(
        'fixed top-0 left-0 flex items-center draggable titlebar-text shrink-0',
        surfaceClassName,
      )}
      style={
        isWco
          ? {
              left: 'env(titlebar-area-x, 0px)',
              top: 'env(titlebar-area-y, 0px)',
              width: 'env(titlebar-area-width, 100%)',
              height: 'env(titlebar-area-height, 36px)',
              paddingLeft: 12,
            }
          : {
              left: 0,
              top: 0,
              width: '100%',
              height: 36,
              paddingLeft: windowChrome === 'mac-hidden' ? 80 : 12,
            }
      }
    >
      <div className="flex items-center gap-2 no-drag min-w-0">
        <AppLogo />
        <span className="text-sm text-text font-semibold truncate">{title}</span>
        {subtitle && (
          <span className="text-xs text-text-muted truncate hidden sm:inline">{subtitle}</span>
        )}
      </div>

      <div className="ml-auto flex items-center no-drag self-stretch">
        <button
          type="button"
          onClick={() =>
            onChangeLanguage(
              language === SUPPORTED_LANGUAGE.EN_US
                ? SUPPORTED_LANGUAGE.ZH_CN
                : SUPPORTED_LANGUAGE.EN_US,
            )
          }
          title={
            language === SUPPORTED_LANGUAGE.EN_US
              ? t(($) => $.language.english)
              : t(($) => $.language.chinese)
          }
          className="px-2 h-7 rounded text-[11px] font-semibold text-text-muted hover:text-text hover:bg-hover transition-colors border-none bg-transparent cursor-pointer"
        >
          {language === SUPPORTED_LANGUAGE.EN_US
            ? t(($) => $.language.enShort)
            : t(($) => $.language.zhShort)}
        </button>

        <button
          type="button"
          onClick={onCycleTheme}
          title={themeLabel}
          aria-label={themeLabel}
          className="w-8 h-7 rounded flex items-center justify-center text-text-muted hover:text-text hover:bg-hover transition-colors border-none bg-transparent cursor-pointer"
        >
          {theme === THEME.LIGHT ? (
            <Sun className="w-3.5 h-3.5" />
          ) : theme === THEME.DARK ? (
            <Moon className="w-3.5 h-3.5" />
          ) : (
            <Monitor className="w-3.5 h-3.5" />
          )}
        </button>

        {isCustom && (
          <>
            <button
              type="button"
              aria-label={t(($) => $.titleBar.minimize)}
              onClick={() => windowApi.minimize()}
              className="w-11 h-full flex items-center justify-center text-text-muted hover:bg-hover transition-colors border-none bg-transparent cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label={
                isMaximized ? t(($) => $.titleBar.restore) : t(($) => $.titleBar.maximize)
              }
              onClick={() => windowApi.toggleMaximize()}
              className="w-11 h-full flex items-center justify-center text-text-muted hover:bg-hover transition-colors border-none bg-transparent cursor-pointer"
            >
              {isMaximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              aria-label={t(($) => $.titleBar.close)}
              onClick={() => windowApi.close()}
              className="w-11 h-full flex items-center justify-center text-text-muted hover:bg-danger hover:text-white transition-colors border-none bg-transparent cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </header>
  )
}

export default TitleBar
