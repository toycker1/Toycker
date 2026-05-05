"use server"

import { createClient } from "@/lib/supabase/server"
import { getAuthUserId } from "@lib/data/auth"
import { getCartId } from "@lib/data/cookies"
import type {
  LayoutCartSummary,
  LayoutCustomer,
  LayoutState,
} from "@/lib/types/layout-state"

type LayoutCustomerProfileRow = {
  first_name: string | null
  is_club_member: boolean | null
}

type LayoutCartItemRow = {
  quantity: number | null
}

type LayoutCartRow = {
  id: string
  user_id: string | null
  region_id: string | null
  currency_code: string | null
  updated_at: string | null
  items?: LayoutCartItemRow[] | null
}

export async function retrieveLayoutCustomer(): Promise<LayoutCustomer | null> {
  const userId = await getAuthUserId()

  if (!userId) {
    return null
  }

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, is_club_member")
    .eq("id", userId)
    .maybeSingle<LayoutCustomerProfileRow>()

  return {
    id: userId,
    first_name: profile?.first_name ?? null,
    is_club_member: profile?.is_club_member ?? false,
  }
}

export async function retrieveLayoutCartSummary(): Promise<LayoutCartSummary | null> {
  const cartId = await getCartId()

  if (!cartId) {
    return null
  }

  const userId = await getAuthUserId()
  const supabase = await createClient()
  const { data: cart } = await supabase
    .from("carts")
    .select(
      `
      id,
      user_id,
      region_id,
      currency_code,
      updated_at,
      items:cart_items(quantity)
    `
    )
    .eq("id", cartId)
    .maybeSingle<LayoutCartRow>()

  if (!cart) {
    return null
  }

  if (cart.user_id && cart.user_id !== userId) {
    return null
  }

  const itemCount = (cart.items ?? []).reduce((total, item) => {
    return total + Math.max(Number(item.quantity ?? 0), 0)
  }, 0)

  return {
    id: cart.id,
    user_id: cart.user_id,
    region_id: cart.region_id,
    currency_code: cart.currency_code ?? "inr",
    updated_at: cart.updated_at,
    item_count: itemCount,
  }
}

export async function retrieveLayoutState(): Promise<LayoutState> {
  const [customer, cart] = await Promise.all([
    retrieveLayoutCustomer(),
    retrieveLayoutCartSummary(),
  ])

  return { customer, cart }
}
