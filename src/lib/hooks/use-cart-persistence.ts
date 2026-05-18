"use client"

import { useEffect, useRef } from "react"
import { Cart } from "@/lib/supabase/types"
import { CART_STORAGE_KEY } from "@modules/layout/utils/layout-state-load-hints"

interface CartStorageData {
    cartId: string | null
    itemCount: number
    lastUpdated: number
}

export const useCartPersistence = (
    cart: Cart | null,
    onStorageChange?: () => void
) => {
    // Use ref to store the callback to avoid dependency issues
    const onStorageChangeRef = useRef(onStorageChange)
    const hasSeenCartRef = useRef(false)

    // Update ref when callback changes
    useEffect(() => {
        onStorageChangeRef.current = onStorageChange
    }, [onStorageChange])

    // Save cart data to localStorage whenever it changes
    useEffect(() => {
        if (typeof window === "undefined") return

        if (!cart && !hasSeenCartRef.current) {
            return
        }

        if (cart) {
            hasSeenCartRef.current = true
        }

        const currentItemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0
        const currentCartId = cart?.id ?? null

        // Read current state to avoid unnecessary writes
        try {
            const stored = localStorage.getItem(CART_STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored) as CartStorageData
                // If data hasn't changed, don't write (prevents loops)
                if (parsed.cartId === currentCartId && parsed.itemCount === currentItemCount) {
                    return
                }
            }
        } catch (e) {
            // Ignore parse errors, proceed to write
        }

        const cartData: CartStorageData = {
            cartId: currentCartId,
            itemCount: currentItemCount,
            lastUpdated: Date.now(),
        }

        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData))
        } catch (error) {
            console.error("Failed to save cart to localStorage:", error)
        }
    }, [cart])

    // Listen for storage events from other tabs
    useEffect(() => {
        if (typeof window === "undefined") return

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === CART_STORAGE_KEY && e.newValue) {
                // Cart was updated in another tab
                onStorageChangeRef.current?.()
            }
        }

        window.addEventListener("storage", handleStorageChange)
        return () => window.removeEventListener("storage", handleStorageChange)
    }, []) // Empty dependency array - only set up once

    // Load initial cart data from localStorage (client-side only)
    useEffect(() => {
        if (typeof window === "undefined") return

        try {
            const stored = localStorage.getItem(CART_STORAGE_KEY)
            if (stored) {
                const data: CartStorageData = JSON.parse(stored)
                // Data is available in localStorage for hydration if needed
                console.debug("Cart data loaded from localStorage:", data)
            }
        } catch (error) {
            console.error("Failed to load cart from localStorage:", error)
        }
    }, [])
}

// Helper to get cart count from localStorage (for SSR-safe initial render)
export const getStoredCartCount = (): number => {
    if (typeof window === "undefined") return 0

    try {
        const stored = localStorage.getItem(CART_STORAGE_KEY)
        if (stored) {
            const data: CartStorageData = JSON.parse(stored)
            return data.itemCount
        }
    } catch (error) {
        console.error("Failed to read cart count from localStorage:", error)
    }

    return 0
}

export const clearStoredCartState = () => {
    if (typeof window === "undefined") return

    const cartData: CartStorageData = {
        cartId: null,
        itemCount: 0,
        lastUpdated: Date.now(),
    }

    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData))
    } catch (error) {
        console.error("Failed to clear cart state in localStorage:", error)
    }
}
