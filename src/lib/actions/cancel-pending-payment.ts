"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { logOrderEvent } from "@/lib/data/admin"

const ONLINE_PAYMENT_METHODS = ["pp_payu_payu", "pp_easebuzz_easebuzz"] as const

/**
 * Cancels any stale pending online-payment orders for the given cart.
 * Called when the user returns to checkout after a cancelled / abandoned payment,
 * and before a new order is created so state is always clean.
 *
 * @param olderThanSeconds - Only cancel orders created more than this many seconds ago.
 *   Use 0 (default) to cancel any age. Use a positive value (e.g. 300) on page-load
 *   cleanup to avoid accidentally cancelling a freshly created order that was just
 *   placed in the same request cycle (Next.js RSC re-render race condition).
 */
export async function cancelPendingPaymentOrders(
  cartId: string,
  olderThanSeconds = 0
): Promise<{ cancelledCount: number }> {
  if (!cartId) return { cancelledCount: 0 }

  const supabase = await createAdminClient()

  let query = supabase
    .from("orders")
    .select("id, payment_method, status, payment_status, created_at")
    .contains("metadata", { cart_id: cartId })
    .eq("status", "pending")
    .eq("payment_status", "pending")

  if (olderThanSeconds > 0) {
    const cutoff = new Date(Date.now() - olderThanSeconds * 1000).toISOString()
    query = query.lt("created_at", cutoff)
  }

  const { data: pendingOrders, error } = await query

  if (error) {
    console.error("[cancelPendingPaymentOrders] DB lookup failed:", error.message)
    return { cancelledCount: 0 }
  }

  if (!pendingOrders || pendingOrders.length === 0) {
    return { cancelledCount: 0 }
  }

  let cancelledCount = 0

  for (const order of pendingOrders) {
    const method = order.payment_method ?? ""
    const isOnlinePayment = ONLINE_PAYMENT_METHODS.some((m) => method === m)
    if (!isOnlinePayment) continue

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        payment_status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)

    if (updateError) {
      console.error(
        "[cancelPendingPaymentOrders] Failed to cancel order:",
        order.id,
        updateError.message
      )
      continue
    }

    try {
      await logOrderEvent(
        order.id,
        "cancelled",
        "Payment Cancelled",
        "Payment was not completed. Order auto-cancelled.",
        "system"
      )
    } catch (logError) {
      console.warn(
        "[cancelPendingPaymentOrders] Failed to log event for order:",
        order.id,
        logError
      )
    }

    cancelledCount++
  }

  return { cancelledCount }
}
