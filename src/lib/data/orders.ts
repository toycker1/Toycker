"use server"

import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { Order } from "@/lib/supabase/types"
import { getAuthUser } from "./auth"
import { logOrderEvent } from "@/lib/data/admin"

export const listOrders = cache(async () => {
  const user = await getAuthUser()
  const supabase = await createClient()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching orders:", error)
    return []
  }

  return data as Order[]
})

export async function retrieveOrder(id: string) {
  // TEMPORARY: Guest checkout bypass — use admin client when no auth user so that
  // guests can view their order confirmation page (anon role may be blocked by RLS).
  // Revert to `const supabase = await createClient()` when OTP login is restored.
  const user = await getAuthUser()
  const supabase = user ? await createClient() : await createAdminClient()

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("Error fetching order:", error)
    return null
  }

  return data as Order
}

export async function cancelUserOrder(orderId: string) {
  const user = await getAuthUser()

  // TEMPORARY: Guest checkout bypass — allow cancellation of guest orders (user_id IS NULL).
  // Security: guests can only cancel orders where user_id is null (their own guest orders).
  // The order UUID (non-guessable) acts as the possession token.
  // Revert to requiring auth when OTP login is restored.
  const fetchClient = user ? await createClient() : await createAdminClient()

  let orderQuery = fetchClient
    .from("orders")
    .select("*")
    .eq("id", orderId)

  if (user) {
    orderQuery = orderQuery.eq("user_id", user.id)
  } else {
    orderQuery = orderQuery.is("user_id", null)
  }

  const { data: order, error } = await orderQuery.maybeSingle()

  if (error) throw new Error(error.message)
  if (!order) throw new Error("Order not found.")

  if (
    ["accepted", "shipped", "delivered", "cancelled", "failed"].includes(
      order.status
    )
  ) {
    throw new Error("Order can no longer be cancelled.")
  }

  const paymentStatus =
    order.payment_status === "captured" ? "refunded" : "cancelled"
  const adminSupabase = await createAdminClient()

  const { error: updateError } = await adminSupabase
    .from("orders")
    .update({
      status: "cancelled",
      fulfillment_status: "cancelled",
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  if (updateError) throw new Error(updateError.message)

  // Deduct Club Membership savings if any
  try {
    const { deductClubSavingsFromOrder } = await import("@lib/data/club")
    await deductClubSavingsFromOrder(orderId)
  } catch (savingsError) {
    console.error("Failed to deduct club savings on cancellation:", savingsError)
    // Non-blocking error for the user, but should be logged
  }

  await logOrderEvent(
    orderId,
    "cancelled",
    "Order Cancelled",
    "Customer cancelled the order.",
    "customer"
  )

  return { success: true }
}
