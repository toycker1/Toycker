"use client"

import { Analytics as VercelAnalytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

import WebVitalsReporter from "@/components/web-vitals-reporter"
import ThirdPartyAnalytics from "@lib/analytics"
import MetaPixel from "@lib/analytics/meta-pixel"

export default function SiteAnalyticsInner() {
  const isProduction = process.env.NODE_ENV === "production"

  return (
    <>
      <ThirdPartyAnalytics />
      <MetaPixel />
      <WebVitalsReporter />
      {isProduction && (
        <>
          <SpeedInsights />
          <VercelAnalytics />
        </>
      )}
    </>
  )
}
