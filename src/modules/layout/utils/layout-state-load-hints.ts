"use client"

export const CART_STORAGE_KEY = "toycker_cart_state"

type CartStorageData = {
  cartId: string | null
  itemCount: number
  lastUpdated?: number
}

type StorageReader = Pick<Storage, "getItem">

type LayoutStateLoadHintsInput = {
  pathname?: string
  cookieString?: string
  storage?: StorageReader
  supabaseUrl?: string
}

const userSpecificRoutePrefixes = ["/cart", "/checkout", "/account"]

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null
}

const getSupabaseProjectRef = (supabaseUrl?: string) => {
  if (!supabaseUrl) {
    return null
  }

  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || null
  } catch {
    return null
  }
}

export const isUserSpecificLayoutPath = (pathname?: string) => {
  if (!pathname) {
    return false
  }

  return userSpecificRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export const hasReadableSupabaseAuthCookie = ({
  cookieString = "",
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
}: Pick<LayoutStateLoadHintsInput, "cookieString" | "supabaseUrl">) => {
  const projectRef = getSupabaseProjectRef(supabaseUrl)
  const cookieNames = cookieString
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter(Boolean)

  if (!projectRef) {
    return cookieNames.some((name) => name.startsWith("sb-") && name.includes("-auth-token"))
  }

  const authCookiePrefix = `sb-${projectRef}-auth-token`

  return cookieNames.some(
    (name) => name === authCookiePrefix || name.startsWith(`${authCookiePrefix}.`)
  )
}

export const readStoredCartHint = (
  storage?: StorageReader
): CartStorageData | null => {
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(CART_STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed: unknown = JSON.parse(raw)

    if (!isRecord(parsed)) {
      return null
    }

    const cartId = parsed.cartId
    const itemCount = parsed.itemCount

    if ((typeof cartId !== "string" && cartId !== null) || typeof itemCount !== "number") {
      return null
    }

    return {
      cartId,
      itemCount,
      lastUpdated: typeof parsed.lastUpdated === "number" ? parsed.lastUpdated : undefined,
    }
  } catch {
    return null
  }
}

export const hasStoredCartHint = (storage?: StorageReader) => {
  const storedCart = readStoredCartHint(storage)

  return Boolean(storedCart?.cartId && storedCart.itemCount > 0)
}

export const getStoredLayoutCartSummary = (storage?: StorageReader) => {
  const storedCart = readStoredCartHint(storage)

  if (!storedCart?.cartId || storedCart.itemCount <= 0) {
    return null
  }

  return {
    id: storedCart.cartId,
    user_id: null,
    region_id: null,
    currency_code: "inr",
    updated_at: null,
    item_count: storedCart.itemCount,
  }
}

export const shouldLoadInitialLayoutState = ({
  pathname = typeof window !== "undefined" ? window.location.pathname : undefined,
  cookieString = typeof document !== "undefined" ? document.cookie : "",
  storage = typeof window !== "undefined" ? window.localStorage : undefined,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
}: LayoutStateLoadHintsInput = {}) => {
  return (
    isUserSpecificLayoutPath(pathname) ||
    hasReadableSupabaseAuthCookie({ cookieString, supabaseUrl }) ||
    hasStoredCartHint(storage)
  )
}
