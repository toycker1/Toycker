"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"

const ADMIN_PATH_PREFIX = "/admin"

const SiteAnalyticsInner = dynamic(() => import("./site-analytics-inner"), {
  ssr: false,
  loading: () => null,
})

export default function SiteAnalytics() {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith(ADMIN_PATH_PREFIX)

  if (isAdmin) {
    return null
  }

  return <SiteAnalyticsInner />
}
