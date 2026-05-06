import * as Sentry from '@sentry/electron/renderer'
import { scrubSentryEvent } from '@shared/utils/sentry-scrub.js'

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    beforeSend: scrubSentryEvent,
  })
}
