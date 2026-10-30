import * as Sentry from '@sentry/electron/main'
import { app } from 'electron'
import { scrubSentryEvent } from '@shared/utils/sentry-scrub.js'

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN
  if (!dsn || !app.isPackaged) return

  Sentry.init({
    dsn,
    environment: 'production',
    beforeSend: scrubSentryEvent,
  })
}
