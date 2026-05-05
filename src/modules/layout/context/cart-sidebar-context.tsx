"use client"

import { Cart } from "@/lib/supabase/types"
import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react"

import { useCartStore } from "@modules/cart/context/cart-store-context"
import { useLayoutData } from "@modules/layout/context/layout-data-context"

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
  const { cart: layoutCart } = useLayoutData()

  const refreshCart = useCallback(async () => {
    try {
      await reloadFromServer()
    } catch (error) {
      console.error("Failed to refresh cart", error)
    }
  }, [reloadFromServer])

  const openCart = useCallback(() => {
    setIsOpen(true)
    if (layoutCart?.item_count && !cart?.items?.length) {
      void reloadFromServer()
    }
  }, [cart?.items?.length, layoutCart?.item_count, reloadFromServer])

  const closeCart = useCallback(() => {
    setIsOpen(false)
  }, [])

  const removeLineItem = useCallback(
    async (lineItemId: string) => {
      try {
        await optimisticRemove(lineItemId)
        await reloadFromServer()
      } catch (error) {
        console.error("Failed to remove line item", error)
        throw error
      }
    },
    [optimisticRemove, reloadFromServer],
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
