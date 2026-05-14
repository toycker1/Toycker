"use client"

import { useReportWebVitals } from "next/web-vitals"

const TELEMETRY_ENDPOINT = "/api/cache/telemetry"
const ALLOWED_SEARCH_PARAM_KEYS = new Set(["page", "sortBy", "step", "view"])

type WebVitalsMetric = {
  id: string
  name: string
  value: number
  label?: string
  startTime?: number
  rating?: string
  delta?: number
  navigationType?: string
}

type WebVitalsPayload = {
  metric: {
    id: string
    name: string
    value: number
    label?: string
    startTime?: number
    rating?: string
    delta?: number
    navigationType?: string
  }
  route: {
    pathname: string
    search: Record<string, string>
  }
}

const getAllowedSearchParams = (searchParams: URLSearchParams): Record<string, string> => {
  const allowedParams: Record<string, string> = {}

  searchParams.forEach((value, key) => {
    if (ALLOWED_SEARCH_PARAM_KEYS.has(key)) {
      allowedParams[key] = value
    }
  })

  return allowedParams
}

const getCurrentRoute = (): WebVitalsPayload["route"] => {
  if (typeof window === "undefined") {
    return {
      pathname: "/",
      search: {},
    }
  }

  return {
    pathname: window.location.pathname || "/",
    search: getAllowedSearchParams(new URLSearchParams(window.location.search)),
  }
}

const sendPayload = (payload: WebVitalsPayload) => {
  const body = JSON.stringify(payload)

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" })

    if (navigator.sendBeacon(TELEMETRY_ENDPOINT, blob)) {
      return
    }
  }

  void fetch(TELEMETRY_ENDPOINT, {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
  }).catch((error: unknown) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[WebVitalsReporter] Failed to send metric", error)
    }
  })
}

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const webVitalsMetric: WebVitalsMetric = metric
    const payload: WebVitalsPayload = {
      metric: {
        id: webVitalsMetric.id,
        name: webVitalsMetric.name,
        label: webVitalsMetric.label,
        value: webVitalsMetric.value,
        startTime: webVitalsMetric.startTime,
        rating: webVitalsMetric.rating,
        delta: webVitalsMetric.delta,
        navigationType: webVitalsMetric.navigationType,
      },
      route: getCurrentRoute(),
    }

    sendPayload(payload)
  })

  return null
}
