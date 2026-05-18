"use client"

type CartItemCountSource = {
  items?: Array<{
    quantity: number
  }> | null
}

type LayoutCartCountSource = {
  item_count?: number | null
}

const getFullCartItemCount = (cart?: CartItemCountSource | null) => {
  if (!cart?.items) {
    return null
  }

  return cart.items.reduce((total, item) => total + item.quantity, 0)
}

export const resolveHeaderCartCount = ({
  cart,
  layoutCart,
}: {
  cart?: CartItemCountSource | null
  layoutCart?: LayoutCartCountSource | null
}) => {
  const fullCartCount = getFullCartItemCount(cart)
  const layoutCartCount = layoutCart?.item_count ?? 0

  if (fullCartCount === null) {
    return layoutCartCount
  }

  if (fullCartCount === 0 && layoutCartCount > 0) {
    return layoutCartCount
  }

  return fullCartCount
}
