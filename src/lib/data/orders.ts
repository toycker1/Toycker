"use server"

import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { Order } from "@/lib/supabase/types"
import { getAuthUser } from "./auth"

export type AccountOrderSummary = Pick<
  Order,
  | "id"
  | "display_id"
  | "created_at"
  | "status"
  | "fulfillment_status"
  | "payment_status"
  | "total"
  | "total_amount"
  | "currency_code"
> & {
  first_item_title: string | null
  first_item_thumbnail: string | null
  item_count: number
}

export const listOrders = cache(async (): Promise<AccountOrderSummary[]> => {
  const user = await getAuthUser()
  const supabase = await createClient()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from("account_order_summaries")
    .select(
      "id, display_id, created_at, status, fulfillment_status, payment_status, total, total_amount, currency_code, first_item_title, first_item_thumbnail, item_count"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching orders:", error)
    return []
  }

  return data as AccountOrderSummary[]
})

export async function retrieveOrder(id: string) {
  const user = await getAuthUser()
  if (!user) return null

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    console.error("Error fetching order:", error)
    return null
  }

  return data as Order
}

export async function cancelUserOrder(orderId: string) {
  const user = await getAuthUser()

  if (!user) {
    throw new Error("Authentication required")
  }

  if (!orderId.trim()) {
    throw new Error("Order ID is required.")
  }

  throw new Error(
    "Customer cancellation is disabled. Please contact support for order changes."
  )
}
