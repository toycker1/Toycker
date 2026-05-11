import { NextResponse } from "next/server"

type TelemetryMetric = {
  id?: unknown
  name?: unknown
  label?: unknown
  value?: unknown
  startTime?: unknown
  rating?: unknown
  delta?: unknown
  navigationType?: unknown
}

type TelemetryRoute = {
  pathname?: unknown
  search?: unknown
}

type TelemetryPayload = {
  metric?: TelemetryMetric
  route?: TelemetryRoute
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
)

const parseTelemetryPayload = (value: unknown): TelemetryPayload | null => {
  if (!isRecord(value) || !isRecord(value.metric) || !isRecord(value.route)) {
    return null
  }

  return {
    metric: value.metric,
    route: value.route,
  }
}

export async function POST(request: Request) {
  try {
    const payload = parseTelemetryPayload(await request.json())

    if (process.env.NODE_ENV !== "production" && payload) {
      console.info("[Telemetry]", {
        metric: payload.metric?.name,
        value: payload.metric?.value,
        route: payload.route?.pathname,
      })
    }
  } catch (error) {
    console.error("Failed to read telemetry payload", error)
  }

  return new NextResponse(null, { status: 204 })
}
