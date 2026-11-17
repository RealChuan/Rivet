import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { terminalApi } from '../../../api/index.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import { useTerminalTheme } from '../hooks/use-terminal-theme.js'
import { useTerminalStore } from '../stores/terminal.js'
import { TERMINAL_FONT_FAMILY } from '../utils/terminal-theme.js'
import '@xterm/xterm/css/xterm.css'
import '../terminal.css'

interface TerminalPanelProps {
  /** 标签身份，与主进程的终端一一对应。 */
  terminalId: string
  sessionId: string
  cwd: string
  /** 激活时把焦点交还给 xterm。 */
  isActive: boolean
}

export const TerminalPanel = ({ terminalId, sessionId, cwd, isActive }: TerminalPanelProps) => {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const setStatus = useTerminalStore((state) => state.setStatus)
  const theme = useTerminalTheme()
  const terminalFontSize = useUiStore((state) => state.terminalFontSize)

  // 翻译函数走 ref，语言切换不该重建终端。
  const translateRef = useRef(t)
  useEffect(() => {
    translateRef.current = t
  }, [t])

  // 打开时取当时的目录，之后换目录不重开终端。
  const cwdRef = useRef(cwd)
  useEffect(() => {
    cwdRef.current = cwd
  }, [cwd])

  // 只在换标签时建终端；主题与字号各自走下面的 effect。
  const themeRef = useRef(theme)
  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  const fontSizeRef = useRef(terminalFontSize)
  useEffect(() => {
    fontSizeRef.current = terminalFontSize
  }, [terminalFontSize])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const encoder = new TextEncoder()
    let disposed = false

    const term = new Terminal({
      // 背景透明，露出面板底色。
      allowTransparency: true,
      cursorBlink: true,
      fontFamily: TERMINAL_FONT_FAMILY,
      fontSize: fontSizeRef.current,
      fontWeight: '400',
      fontWeightBold: '600',
      letterSpacing: 0,
      lineHeight: 1.35,
      scrollback: 5000,
      theme: themeRef.current,
    })
    terminalRef.current = term

    const fit = new FitAddon()
    term.loadAddon(fit)
    fitRef.current = fit
    term.open(container)

    const fitIfVisible = (): void => {
      if (container.clientWidth > 0 && container.clientHeight > 0) fit.fit()
    }
    fitIfVisible()

    // 字体晚于首帧就绪会改变单元格宽度，需重算，否则出现横向滚动条。
    if (typeof document.fonts !== 'undefined') {
      void document.fonts.ready.then(() => {
        if (!disposed) fitIfVisible()
      })
    }

    // 先订阅再 open：首屏提示符可能早于 open 返回。
    const offData = terminalApi.onData((payload) => {
      if (payload.terminalId === terminalId) term.write(payload.data)
    })

    const offExit = terminalApi.onExit((info) => {
      if (info.terminalId !== terminalId) return
      if (info.reason === 'error') {
        setStatus(
          terminalId,
          'error',
          info.error ? resolveErrorMessage(translateRef.current, info.error) : undefined,
        )
        return
      }
      setStatus(terminalId, 'exited')
    })

    const inputDisposable = term.onData((data) => {
      terminalApi.write(terminalId, encoder.encode(data))
    })

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      terminalApi.resize(terminalId, cols, rows)
    })

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => fitIfVisible())
    observer?.observe(container)

    setStatus(terminalId, 'connecting')
    void (async () => {
      try {
        await terminalApi.open({
          terminalId,
          sessionId,
          cols: term.cols,
          rows: term.rows,
          cwd: cwdRef.current,
        })
        if (disposed) {
          // 标签在 open 期间被关掉时，主进程里已建好的终端没人收。
          if (!useTerminalStore.getState().hasTab(terminalId)) {
            await terminalApi.close(terminalId).catch(() => undefined)
          }
          return
        }
        setStatus(terminalId, 'ready')
      } catch (error) {
        if (disposed) return
        setStatus(terminalId, 'error', resolveErrorMessage(translateRef.current, error))
      }
    })()

    return () => {
      disposed = true
      observer?.disconnect()
      offData()
      offExit()
      inputDisposable.dispose()
      resizeDisposable.dispose()
      // 卸载不等于关标签：ssh 由 store 的 removeTab / forget 收掉。
      term.dispose()
      terminalRef.current = null
      fitRef.current = null
    }
  }, [terminalId, sessionId, setStatus])

  // 切回标签时把焦点交给 xterm。
  useEffect(() => {
    if (isActive) terminalRef.current?.focus()
  }, [isActive])

  useEffect(() => {
    const term = terminalRef.current
    if (term) term.options.theme = theme
  }, [theme])

  // 字号变化会改变列数，需重排一次。
  useEffect(() => {
    const term = terminalRef.current
    const fit = fitRef.current
    if (!term || !fit) return
    term.options.fontSize = terminalFontSize
    fit.fit()
  }, [terminalFontSize])

  // 内边距放在 xterm 父节点之外：FitAddon 只用父节点的 width/height 估算列数。
  return (
    <div className="terminal-surface h-full w-full px-3 py-2" data-testid="terminal-panel">
      <div ref={containerRef} className="h-full w-full overflow-hidden" />
    </div>
  )
}
