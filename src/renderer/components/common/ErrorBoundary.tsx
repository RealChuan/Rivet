import type { ErrorInfo, ReactNode } from 'react'
import * as Sentry from '@sentry/electron/renderer'
import { Component } from 'react'
import i18n from '../../i18n/config.js'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } })
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-transparent">
          <div className="flex flex-col items-center gap-4">
            <p className="text-danger text-sm">
              {this.state.error?.message ?? i18n.t('error.unknown')}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-md bg-glass-bg px-3 py-1.5 text-sm text-text border border-border hover:bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {i18n.t('common.action.refresh')}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
