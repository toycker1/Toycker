"use client"

import { useCartStore } from "@modules/cart/context/cart-store-context"
import { useLayoutData } from "@modules/layout/context/layout-data-context"
import { resolveHeaderCartCount } from "@modules/layout/utils/cart-count"

export const CartBadge = () => {
    const { cart } = useCartStore()
    const { cart: layoutCart } = useLayoutData()
    const count = resolveHeaderCartCount({ cart, layoutCart })

    if (count === 0) return null

    return (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
            {count}
        </span>
    )
}
