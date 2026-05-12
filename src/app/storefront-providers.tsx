"use client"

import { ReactNode } from "react"

import PWAClientWrapper from "@/components/pwa-client-wrapper"
import { CartStoreProvider } from "@modules/cart/context/cart-store-context"
import { ShippingPriceProvider } from "@modules/common/context/shipping-price-context"
import { CartSidebarProvider } from "@modules/layout/context/cart-sidebar-context"
import { LayoutDataProvider } from "@modules/layout/context/layout-data-context"
import { PWAProvider } from "@modules/layout/components/pwa-install-prompt/PWAContext"
import { WishlistProvider } from "@modules/products/context/wishlist"

export default function StorefrontProviders({
  children,
}: {
  children: ReactNode
}) {
  return (
    <LayoutDataProvider>
      <CartStoreProvider>
        <ShippingPriceProvider>
          <CartSidebarProvider>
            <WishlistProvider>
              <PWAProvider>
                {children}
                <PWAClientWrapper />
              </PWAProvider>
            </WishlistProvider>
          </CartSidebarProvider>
        </ShippingPriceProvider>
      </CartStoreProvider>
    </LayoutDataProvider>
  )
}
