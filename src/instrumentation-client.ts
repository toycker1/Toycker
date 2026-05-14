"use client"

import * as Sentry from "@sentry/nextjs"

export const onRouterTransitionStart = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? Sentry.captureRouterTransitionStart
  : undefined

export function register() {
  if (typeof window === "undefined") {
    return
  }

  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN

  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      tracesSampleRate: 0.1,
      debug: false,
      replaysOnErrorSampleRate: 0.05,
      replaysSessionSampleRate: 0,
      integrations: [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
    })
  }
}
