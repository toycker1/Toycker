"use client"

import { Cart } from "@/lib/supabase/types"
import { ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from "react"

import { useCartStore } from "@modules/cart/context/cart-store-context"

type CartSidebarContextValue = {
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  cart: Cart | null
  setCart: (_cart: Cart | null) => void
  refreshCart: () => Promise<void>
  removeLineItem: (_lineItemId: string) => Promise<void>
  isRemoving: (_lineItemId: string) => boolean
}

const CartSidebarContext = createContext<CartSidebarContextValue | undefined>(
  undefined,
)

export const CartSidebarProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false)
  const { cart, setFromServer, optimisticRemove, reloadFromServer, isRemoving } = useCartStore()
  const hasLoadedCartOnOpen = useRef(false)

  const refreshCart = useCallback(async () => {
    try {
      await reloadFromServer()
    } catch (error) {
      console.error("Failed to refresh cart", error)
    }
  }, [reloadFromServer])

  const openCart = useCallback(() => {
    setIsOpen(true)
    if (!cart?.items?.length && !hasLoadedCartOnOpen.current) {
      hasLoadedCartOnOpen.current = true
      void reloadFromServer()
    }
  }, [cart?.items?.length, reloadFromServer])

  const closeCart = useCallback(() => {
    setIsOpen(false)
  }, [])

  const removeLineItem = useCallback(
    async (lineItemId: string) => {
      try {
        await optimisticRemove(lineItemId)
      } catch (error) {
        console.error("Failed to remove line item", error)
        throw error
      }
    },
    [optimisticRemove],
  )

  const value = useMemo(
    () => ({
      isOpen,
      openCart,
      closeCart,
      cart,
      setCart: setFromServer,
      refreshCart,
      removeLineItem,
      isRemoving,
    }),
    [cart, closeCart, isOpen, openCart, refreshCart, removeLineItem, setFromServer, isRemoving],
  )

  return (
    <CartSidebarContext.Provider value={value}>
      {children}
    </CartSidebarContext.Provider>
  )
}

export const useCartSidebar = () => {
  const context = useContext(CartSidebarContext)

  if (!context) {
    throw new Error("useCartSidebar must be used within a CartSidebarProvider")
  }

  return context
}

export const useOptionalCartSidebar = () => {
  return useContext(CartSidebarContext)
}
