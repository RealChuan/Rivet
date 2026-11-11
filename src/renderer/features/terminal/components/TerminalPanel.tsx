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
  sessionId: string
  cwd: string
}

interface PendingChunk {
  terminalId: string
  data: Uint8Array
}

export const TerminalPanel = ({ sessionId, cwd }: TerminalPanelProps) => {
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

  // 只在换会话时建终端；主题与字号各自走下面的 effect。
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
    const pending: PendingChunk[] = []
    const active: { terminalId: string | null } = { terminalId: null }
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

    // 先订阅再 open：首屏提示符可能在 open 返回前就到达。
    const offData = terminalApi.onData((payload) => {
      if (active.terminalId === null) {
        pending.push(payload)
        return
      }
      if (payload.terminalId === active.terminalId) term.write(payload.data)
    })

    const offExit = terminalApi.onExit((info) => {
      if (active.terminalId === null || info.terminalId !== active.terminalId) return
      if (info.reason === 'error') {
        setStatus(
          sessionId,
          'error',
          info.error ? resolveErrorMessage(translateRef.current, info.error) : undefined,
        )
        return
      }
      setStatus(sessionId, 'exited')
    })

    const inputDisposable = term.onData((data) => {
      if (active.terminalId !== null) terminalApi.write(active.terminalId, encoder.encode(data))
    })

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (active.terminalId !== null) terminalApi.resize(active.terminalId, cols, rows)
    })

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => fitIfVisible())
    observer?.observe(container)

    setStatus(sessionId, 'connecting')
    void (async () => {
      try {
        const opened = await terminalApi.open({
          sessionId,
          cols: term.cols,
          rows: term.rows,
          cwd: cwdRef.current,
        })
        if (disposed) {
          await terminalApi.close(opened.terminalId).catch(() => undefined)
          return
        }
        active.terminalId = opened.terminalId
        for (const chunk of pending) {
          if (chunk.terminalId === active.terminalId) term.write(chunk.data)
        }
        pending.length = 0
        setStatus(sessionId, 'ready')
      } catch (error) {
        if (disposed) return
        setStatus(sessionId, 'error', resolveErrorMessage(translateRef.current, error))
      }
    })()

    return () => {
      disposed = true
      observer?.disconnect()
      offData()
      offExit()
      inputDisposable.dispose()
      resizeDisposable.dispose()
      const id = active.terminalId
      active.terminalId = null
      if (id !== null) void terminalApi.close(id).catch(() => undefined)
      term.dispose()
      terminalRef.current = null
      fitRef.current = null
    }
  }, [sessionId, setStatus])

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
