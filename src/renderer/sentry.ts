import * as Sentry from '@sentry/electron/renderer'

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string, // 已通过条件检查确保非 undefined
    sendDefaultPii: false,
  })
}
