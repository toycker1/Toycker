"use client"

import type { ShippingOption } from "@/lib/supabase/types"
import type {
  LayoutCartSummary,
  LayoutCustomer,
  LayoutState,
  ShippingOptionsState,
} from "@/lib/types/layout-state"
import {
  getStoredLayoutCartSummary,
  shouldLoadInitialLayoutState,
} from "@modules/layout/utils/layout-state-load-hints"
import { usePathname } from "next/navigation"
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

type LayoutDataContextValue = {
  cart: LayoutCartSummary | null
  setCart: (_cart: LayoutCartSummary | null) => void
  customer: LayoutCustomer | null
  setCustomer: (_customer: LayoutCustomer | null) => void
  shippingOptions: ShippingOption[]
  loading: boolean
  refresh: () => Promise<void>
  loadShippingOptions: () => Promise<void>
}

const LayoutDataContext = createContext<LayoutDataContextValue | undefined>(undefined)

const fetchLayoutState = async (signal?: AbortSignal) => {
  try {
    const response = await fetch("/api/storefront/layout-state", {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      console.warn("Layout state API returned non-OK status:", response.status)
      // Return empty state instead of throwing to avoid breaking the app
      return { cart: null, customer: null }
    }

    return (await response.json()) as LayoutState
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      throw error // Re-throw abort errors to be handled by caller
    }
    console.warn("Failed to fetch layout state:", error)
    // Return empty state for network errors
    return { cart: null, customer: null }
  }
}

const fetchShippingOptions = async (signal?: AbortSignal) => {
  try {
    const response = await fetch("/api/storefront/shipping-options", {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      throw new Error("Failed to load shipping options")
    }

    return (await response.json()) as ShippingOptionsState
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      return {
        shippingOptions: [],
        regionId: null,
      }
    }
    throw error
  }
}

const getBrowserStoredCartSummary = () => {
  if (typeof window === "undefined") {
    return null
  }

  return getStoredLayoutCartSummary(window.localStorage)
}

export const LayoutDataProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<LayoutCartSummary | null>(null)
  const [customer, setCustomer] = useState<LayoutCustomer | null>(null)
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [shippingOptionsRegion, setShippingOptionsRegion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const abortController = useRef<AbortController | null>(null)
  const shippingAbortController = useRef<AbortController | null>(null)
  const hasLoadedLayoutState = useRef(false)
  const pathname = usePathname()

  const loadShippingOptions = useCallback(async () => {
    if (!cart?.id) {
      setShippingOptions([])
      setShippingOptionsRegion(null)
      return
    }

    if (shippingOptions.length && shippingOptionsRegion === cart.region_id) {
      return
    }

    shippingAbortController.current?.abort()

    const controller = new AbortController()
    shippingAbortController.current = controller

    try {
      const payload = await fetchShippingOptions(controller.signal)
      setShippingOptions(payload.shippingOptions)
      setShippingOptionsRegion(payload.regionId ?? cart.region_id ?? null)
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        return
      }
      console.error("Failed to load shipping options", error)
    } finally {
      if (shippingAbortController.current === controller) {
        shippingAbortController.current = null
      }
    }
  }, [cart?.id, cart?.region_id, shippingOptions.length, shippingOptionsRegion])

  const refresh = useCallback(async () => {
    abortController.current?.abort()

    const controller = new AbortController()
    abortController.current = controller
    setLoading(true)
    const storedCartSummary = getBrowserStoredCartSummary()

    try {
      const payload = await fetchLayoutState(controller.signal)
      setCart(payload.cart ?? storedCartSummary)
      setCustomer(payload.customer)

      const resolvedCart = payload.cart ?? storedCartSummary

      if (!resolvedCart) {
        setShippingOptions([])
        setShippingOptionsRegion(null)
      } else if (
        shippingOptionsRegion &&
        resolvedCart.region_id &&
        resolvedCart.region_id !== shippingOptionsRegion
      ) {
        setShippingOptions([])
        setShippingOptionsRegion(null)
      }
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        return
      }
      console.error("Failed to refresh layout data", error)
    } finally {
      if (abortController.current === controller) {
        setLoading(false)
        abortController.current = null
      }
    }
  }, [shippingOptionsRegion])

  useEffect(() => {
    if (!shouldLoadInitialLayoutState({ pathname })) {
      if (!hasLoadedLayoutState.current) {
        setCart(null)
        setCustomer(null)
        setShippingOptions([])
        setShippingOptionsRegion(null)
        setLoading(false)
      }
      return
    }

    hasLoadedLayoutState.current = true
    setCart((currentCart) => currentCart ?? getBrowserStoredCartSummary())
    refresh()

    return () => {
      abortController.current?.abort()
      shippingAbortController.current?.abort()
    }
  }, [pathname, refresh])

  const value = useMemo(
    () => ({
      cart,
      setCart,
      customer,
      setCustomer,
      shippingOptions,
      loading,
      refresh,
      loadShippingOptions,
    }),
    [cart, customer, shippingOptions, loading, refresh, loadShippingOptions],
  )

  return <LayoutDataContext.Provider value={value}>{children}</LayoutDataContext.Provider>
}

export const useLayoutData = () => {
  const context = useContext(LayoutDataContext)

  if (!context) {
    throw new Error("useLayoutData must be used within a LayoutDataProvider")
  }

  return context
}
