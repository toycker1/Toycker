type RateLimitEntry = {
  count: number
  resetAt: number
}

type RateLimitOptions = {
  key: string
  limit: number
  windowMs: number
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

const buckets = new Map<string, RateLimitEntry>()

const cleanupExpiredBuckets = (now: number) => {
  for (const [key, entry] of Array.from(buckets.entries())) {
    if (entry.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

export const checkRequestRateLimit = ({
  key,
  limit,
  windowMs,
}: RateLimitOptions): RateLimitResult => {
  const now = Date.now()
  cleanupExpiredBuckets(now)

  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })

    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt,
      retryAfterSeconds: 0,
    }
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }

  current.count += 1
  buckets.set(key, current)

  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
    retryAfterSeconds: 0,
  }
}

export const getClientIpFromHeaders = (headers: Headers): string => {
  const cfConnectingIp = headers.get("cf-connecting-ip")?.trim()

  if (cfConnectingIp) {
    return cfConnectingIp
  }

  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim()

  if (forwardedFor) {
    return forwardedFor
  }

  return headers.get("x-real-ip")?.trim() || "unknown"
}
