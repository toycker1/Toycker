"use client"

import { useState, useTransition, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShoppingBag } from "lucide-react"

import { addToCart } from "@lib/data/cart"
import { cn } from "@lib/util/cn"
import { useCartStore } from "@modules/cart/context/cart-store-context"
import { useOptionalCartSidebar } from "@modules/layout/context/cart-sidebar-context"
import WishlistButton from "@modules/products/components/wishlist-button"

type HomeProductCardActionsProps = {
  productId: string
  productHandle: string
  productTitle: string
  variantId?: string | null
  hasVariants: boolean
}

const HomeProductCardActions = ({
  productId,
  productHandle,
  productTitle,
  variantId,
  hasVariants,
}: HomeProductCardActionsProps) => {
  const router = useRouter()
  const cartSidebar = useOptionalCartSidebar()
  const { setFromServer } = useCartStore()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<"idle" | "added" | "error">("idle")

  const buttonLabel =
    status === "added"
      ? "Added!"
      : status === "error"
        ? "Try again"
        : hasVariants
          ? "View Options"
          : "Add to Cart"

  const handleAction = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (hasVariants) {
      router.push(`/products/${productHandle}`)
      return
    }

    startTransition(async () => {
      setStatus("added")
      cartSidebar?.openCart()

      try {
        const cart = await addToCart({
          productId,
          variantId: variantId ?? undefined,
          quantity: 1,
        })

        if (cart) {
          setFromServer(cart)
        }

        window.setTimeout(() => setStatus("idle"), 2000)
      } catch {
        setStatus("error")
        window.setTimeout(() => setStatus("idle"), 2000)
      }
    })
  }

  return (
    <>
      <div className="absolute right-3 top-3 z-20 hidden translate-x-4 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:block">
        <WishlistButton productId={productId} productTitle={productTitle} />
      </div>

      <div className="absolute right-2 bottom-2 z-20 flex flex-col gap-2 sm:hidden">
        <WishlistButton productId={productId} productTitle={productTitle} />
        <button
          type="button"
          onClick={handleAction}
          disabled={isPending}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 p-2 text-slate-900 shadow-sm transition hover:text-ui-fg-base disabled:cursor-not-allowed"
          aria-label={buttonLabel}
        >
          {isPending ? (
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          ) : (
            <ShoppingBag className="h-6 w-6" aria-hidden />
          )}
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 hidden translate-y-2 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 sm:block">
        <button
          type="button"
          onClick={handleAction}
          disabled={isPending}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition-all",
            "bg-white text-slate-900 hover:bg-primary hover:text-white disabled:cursor-not-allowed"
          )}
        >
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : buttonLabel}
        </button>
      </div>
    </>
  )
}

export default HomeProductCardActions
