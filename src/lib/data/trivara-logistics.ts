"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermission } from "@/lib/permissions/server"
import { PERMISSIONS } from "@/lib/permissions"
import {
  Order,
  TrivaraOrderBooking,
  TrivaraOrderBookingStatus,
  TrivaraSyncSnapshot,
  TrivaraSyncSnapshotKey,
} from "@/lib/supabase/types"
import { ensureAdmin, retryTrivaraBookingForOrder } from "./admin"
import {
  getTrivaraApiBaseUrl,
  getTrivaraApiKey,
  getTrivaraCrnNo,
  getTrivaraMasterApiKey,
  getTrivaraPrintSlipApiBaseUrl,
  getTrivaraServicesApiBaseUrl,
  getTrivaraTrackingApiKey,
  sendTrivaraCancelOrder,
  sendTrivaraOrderTracking,
  sendTrivaraPickupLocations,
  sendTrivaraPrintSlip,
  sendTrivaraServices,
  sendTrivaraTotalOrders,
} from "@/lib/integrations/trivara"

type LogisticsOrderSummary = Pick<
  Order,
  | "id"
  | "display_id"
  | "customer_email"
  | "status"
  | "payment_method"
  | "payment_status"
  | "total_amount"
  | "currency_code"
  | "created_at"
  | "shipping_address"
>

export type TrivaraLogisticsRecord = TrivaraOrderBooking & {
  order: LogisticsOrderSummary | null
}

export type TrivaraLogisticsListParams = {
  page?: number
  limit?: number
  status?: TrivaraOrderBookingStatus | "all"
  search?: string
}

export type TrivaraLogisticsListResponse = {
  records: TrivaraLogisticsRecord[]
  count: number
  totalPages: number
  currentPage: number
}

export type TrivaraSyncActionResult = {
  success: boolean
  message: string
}

function revalidateLogistics(orderId?: string) {
  revalidatePath("/admin/logistics")
  if (orderId) {
    revalidatePath(`/admin/logistics/${orderId}`)
  }
}

function getResponseStatus(payload: Record<string, unknown>): string | null {
  const queue: unknown[] = [payload]
  const statusKeys = new Set([
    "status",
    "current_status",
    "shipment_status",
    "tracking_status",
  ])

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      continue
    }

    for (const [key, value] of Object.entries(current)) {
      if (statusKeys.has(key) && typeof value === "string" && value.trim()) {
        return value.trim()
      }

      if (value && typeof value === "object") {
        queue.push(value)
      }
    }
  }

  return null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Trivara error"
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function getPayloadString(
  payload: Record<string, unknown>,
  keys: string[]
): string | null {
  const queue: unknown[] = [payload]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!isObjectRecord(current)) {
      continue
    }

    for (const [key, value] of Object.entries(current)) {
      if (keys.includes(key) && typeof value === "string" && value.trim()) {
        return value.trim()
      }

      if (isObjectRecord(value) || Array.isArray(value)) {
        queue.push(value)
      }
    }
  }

  return null
}

function isTrivaraResponseSuccessful(response: {
  ok: boolean
  responsePayload: Record<string, unknown>
}): boolean {
  if (!response.ok) {
    return false
  }

  const error = getPayloadString(response.responsePayload, ["error"])
  if (error) {
    return false
  }

  const success = response.responsePayload.success
  if (typeof success === "boolean") {
    return success
  }

  if (typeof success === "string") {
    const normalized = success.trim().toLowerCase()
    if (["0", "false", "failed", "error"].includes(normalized)) {
      return false
    }
    if (["1", "true", "success"].includes(normalized)) {
      return true
    }
  }

  return true
}

function getTrivaraResponseError(
  response: {
    status: number
    responsePayload: Record<string, unknown>
  },
  fallback: string
): string {
  return (
    getPayloadString(response.responsePayload, ["error", "message"]) ||
    `${fallback} with status ${response.status}`
  )
}

async function getBooking(orderId: string): Promise<TrivaraOrderBooking> {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from("trivara_order_bookings")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error("Trivara booking record was not found for this order.")
  }

  return data as TrivaraOrderBooking
}

async function updateBooking(orderId: string, values: Record<string, unknown>) {
  const supabase = await createAdminClient()
  const { error } = await supabase
    .from("trivara_order_bookings")
    .update(values)
    .eq("order_id", orderId)

  if (error) {
    throw new Error(error.message)
  }
}

async function upsertSnapshot(
  syncKey: TrivaraSyncSnapshotKey,
  values: Pick<
    TrivaraSyncSnapshot,
    "request_payload" | "response_payload" | "error_message" | "synced_at"
  >
) {
  const supabase = await createAdminClient()
  const { error } = await supabase.from("trivara_sync_snapshots").upsert(
    {
      sync_key: syncKey,
      ...values,
    },
    { onConflict: "sync_key" }
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function getTrivaraLogisticsRecords(
  params: TrivaraLogisticsListParams = {}
): Promise<TrivaraLogisticsListResponse> {
  await ensureAdmin()
  await requirePermission(PERMISSIONS.SHIPPING_READ)

  const { page = 1, limit = 20, status = "all", search = "" } = params
  const supabase = await createAdminClient()
  let query = supabase
    .from("trivara_order_bookings")
    .select("*")
    .order("updated_at", { ascending: false })

  if (status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  const bookings = (data || []) as TrivaraOrderBooking[]
  const orderIds = bookings.map((booking) => booking.order_id)
  const ordersById = new Map<string, LogisticsOrderSummary>()

  if (orderIds.length > 0) {
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(
        "id, display_id, customer_email, status, payment_method, payment_status, total_amount, currency_code, created_at, shipping_address"
      )
      .in("id", orderIds)

    if (ordersError) {
      throw new Error(ordersError.message)
    }

    ;((orders || []) as LogisticsOrderSummary[]).forEach((order) => {
      ordersById.set(order.id, order)
    })
  }

  const normalizedSearch = search.trim().toLowerCase()
  const records = bookings
    .map((booking) => ({
      ...booking,
      order: ordersById.get(booking.order_id) || null,
    }))
    .filter((record) => {
      if (!normalizedSearch) {
        return true
      }

      return [
        record.trivara_reference_number,
        record.order?.customer_email,
        record.order?.display_id?.toString(),
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    })

  const count = records.length
  const totalPages = Math.ceil(count / limit) || 1
  const offset = (page - 1) * limit

  return {
    records: records.slice(offset, offset + limit),
    count,
    totalPages,
    currentPage: page,
  }
}

export async function getTrivaraLogisticsRecord(
  orderId: string
): Promise<TrivaraLogisticsRecord | null> {
  await ensureAdmin()
  await requirePermission(PERMISSIONS.SHIPPING_READ)

  const booking = await getBooking(orderId).catch(() => null)
  if (!booking) {
    return null
  }

  const supabase = await createAdminClient()
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, display_id, customer_email, status, payment_method, payment_status, total_amount, currency_code, created_at, shipping_address"
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return {
    ...booking,
    order: order ? (order as LogisticsOrderSummary) : null,
  }
}

export async function getTrivaraSyncSnapshots(): Promise<
  TrivaraSyncSnapshot[]
> {
  await ensureAdmin()
  await requirePermission(PERMISSIONS.SHIPPING_READ)

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from("trivara_sync_snapshots")
    .select("*")
    .order("updated_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as TrivaraSyncSnapshot[]
}

export async function retryTrivaraBooking(orderId: string) {
  await retryTrivaraBookingForOrder(orderId)
  revalidateLogistics(orderId)
}

export async function trackTrivaraOrder(orderId: string) {
  await ensureAdmin()
  await requirePermission(PERMISSIONS.SHIPPING_UPDATE)

  const booking = await getBooking(orderId)
  if (!booking.trivara_reference_number) {
    throw new Error("Trivara reference number is required before tracking.")
  }

  const payload = {
    crn_no: getTrivaraCrnNo(),
    action: "track" as const,
    waybill: booking.trivara_reference_number,
  }
  const response = await sendTrivaraOrderTracking(payload, {
    apiBaseUrl: getTrivaraApiBaseUrl(),
    apiKey: getTrivaraTrackingApiKey(),
  })

  await updateBooking(orderId, {
    tracking_payload: response.responsePayload,
    tracking_status: getResponseStatus(response.responsePayload),
    tracking_synced_at: new Date().toISOString(),
  })

  if (!response.ok) {
    throw new Error(`Trivara tracking failed with status ${response.status}`)
  }

  revalidateLogistics(orderId)
}

export async function printTrivaraSlip(orderId: string) {
  await ensureAdmin()
  await requirePermission(PERMISSIONS.SHIPPING_UPDATE)

  const booking = await getBooking(orderId)
  if (!booking.trivara_reference_number) {
    throw new Error("Trivara reference number is required before printing.")
  }

  const payload = {
    crn_no: getTrivaraCrnNo(),
    reference_number: booking.trivara_reference_number,
    awb_number: booking.trivara_reference_number,
  }
  const response = await sendTrivaraPrintSlip(payload, {
    apiBaseUrl: getTrivaraPrintSlipApiBaseUrl(),
    apiKey: getTrivaraApiKey(),
  })

  await updateBooking(orderId, {
    print_slip_payload: response.responsePayload,
    print_slip_synced_at: new Date().toISOString(),
  })

  if (!response.ok) {
    throw new Error(`Trivara print slip failed with status ${response.status}`)
  }

  revalidateLogistics(orderId)
}

export async function cancelTrivaraOrder(orderId: string) {
  await ensureAdmin()
  await requirePermission(PERMISSIONS.SHIPPING_UPDATE)

  const booking = await getBooking(orderId)
  if (!booking.trivara_reference_number) {
    throw new Error("Trivara reference number is required before cancellation.")
  }

  const payload = {
    crn_no: getTrivaraCrnNo(),
    reference_number: booking.trivara_reference_number,
  }
  const response = await sendTrivaraCancelOrder(payload, {
    apiBaseUrl: getTrivaraApiBaseUrl(),
    apiKey: getTrivaraApiKey(),
  })
  const errorMessage = response.ok
    ? null
    : `Trivara cancellation failed with status ${response.status}`

  await updateBooking(orderId, {
    status: response.ok ? "cancelled" : booking.status,
    cancel_payload: response.responsePayload,
    cancel_error_message: errorMessage,
    cancelled_at: response.ok ? new Date().toISOString() : null,
  })

  if (errorMessage) {
    throw new Error(errorMessage)
  }

  revalidateLogistics(orderId)
}

export async function syncTrivaraPickupLocations(): Promise<TrivaraSyncActionResult> {
  await ensureAdmin()
  await requirePermission(PERMISSIONS.SHIPPING_UPDATE)

  let requestPayload: Record<string, unknown> = {}

  try {
    requestPayload = { crn_no: getTrivaraCrnNo() }
    const response = await sendTrivaraPickupLocations(
      requestPayload as { crn_no: string },
      {
        apiBaseUrl: getTrivaraApiBaseUrl(),
        apiKey: getTrivaraMasterApiKey(),
      }
    )

    const isSuccessful = isTrivaraResponseSuccessful(response)
    const errorMessage = isSuccessful
      ? null
      : getTrivaraResponseError(response, "Trivara pickup locations failed")

    await upsertSnapshot("pickup_locations", {
      request_payload: requestPayload,
      response_payload: response.responsePayload,
      error_message: errorMessage,
      synced_at: new Date().toISOString(),
    })

    revalidateLogistics()

    return {
      success: isSuccessful,
      message: isSuccessful
        ? "Pickup locations synced successfully."
        : "Pickup locations sync failed. Check Trivara credentials.",
    }
  } catch (error) {
    await upsertSnapshot("pickup_locations", {
      request_payload: requestPayload,
      response_payload: null,
      error_message: getErrorMessage(error),
      synced_at: new Date().toISOString(),
    })

    revalidateLogistics()

    return {
      success: false,
      message: "Pickup locations sync failed. Check Trivara credentials.",
    }
  }
}

export async function syncTrivaraServices(): Promise<TrivaraSyncActionResult> {
  await ensureAdmin()
  await requirePermission(PERMISSIONS.SHIPPING_UPDATE)

  let requestPayload: Record<string, unknown> = {}

  try {
    requestPayload = { crn_no: getTrivaraCrnNo() }
    const response = await sendTrivaraServices(
      requestPayload as { crn_no: string },
      {
        apiBaseUrl: getTrivaraServicesApiBaseUrl(),
        apiKey: getTrivaraMasterApiKey(),
      }
    )

    const isSuccessful = isTrivaraResponseSuccessful(response)
    const errorMessage = isSuccessful
      ? null
      : getTrivaraResponseError(response, "Trivara services failed")

    await upsertSnapshot("services", {
      request_payload: requestPayload,
      response_payload: response.responsePayload,
      error_message: errorMessage,
      synced_at: new Date().toISOString(),
    })

    revalidateLogistics()

    return {
      success: isSuccessful,
      message: isSuccessful
        ? "Services synced successfully."
        : "Services sync failed. Check Trivara credentials.",
    }
  } catch (error) {
    await upsertSnapshot("services", {
      request_payload: requestPayload,
      response_payload: null,
      error_message: getErrorMessage(error),
      synced_at: new Date().toISOString(),
    })

    revalidateLogistics()

    return {
      success: false,
      message: "Services sync failed. Check Trivara credentials.",
    }
  }
}

export async function syncTrivaraTotalOrders(
  formData: FormData
): Promise<TrivaraSyncActionResult> {
  await ensureAdmin()
  await requirePermission(PERMISSIONS.SHIPPING_UPDATE)

  const startDate = String(formData.get("start_date") || "").trim()
  const endDate = String(formData.get("end_date") || "").trim()

  if (!startDate || !endDate) {
    return {
      success: false,
      message: "Start date and end date are required.",
    }
  }

  let requestPayload: Record<string, unknown> = {
    start_date: startDate,
    end_date: endDate,
  }

  try {
    requestPayload = {
      ...requestPayload,
      crn_no: getTrivaraCrnNo(),
    }
    const response = await sendTrivaraTotalOrders(
      requestPayload as {
        crn_no: string
        start_date: string
        end_date: string
      },
      {
        apiBaseUrl: getTrivaraApiBaseUrl(),
        apiKey: getTrivaraApiKey(),
      }
    )

    const isSuccessful = isTrivaraResponseSuccessful(response)
    const errorMessage = isSuccessful
      ? null
      : getTrivaraResponseError(response, "Trivara total orders failed")

    await upsertSnapshot("total_orders", {
      request_payload: requestPayload,
      response_payload: response.responsePayload,
      error_message: errorMessage,
      synced_at: new Date().toISOString(),
    })

    revalidateLogistics()

    return {
      success: isSuccessful,
      message: isSuccessful
        ? "Total orders synced successfully."
        : "Total orders sync failed. Check Trivara credentials.",
    }
  } catch (error) {
    await upsertSnapshot("total_orders", {
      request_payload: requestPayload,
      response_payload: null,
      error_message: getErrorMessage(error),
      synced_at: new Date().toISOString(),
    })

    revalidateLogistics()

    return {
      success: false,
      message: "Total orders sync failed. Check Trivara credentials.",
    }
  }
}
