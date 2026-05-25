"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermission } from "@/lib/permissions/server"
import { PERMISSIONS } from "@/lib/permissions"
import {
  Order,
  OrderTimeline,
  TrivaraOrderBooking,
  TrivaraOrderBookingStatus,
  TrivaraSyncSnapshot,
  TrivaraSyncSnapshotKey,
} from "@/lib/supabase/types"
import { cancelOrder, ensureAdmin, retryTrivaraBookingForOrder } from "./admin"
import {
  extractTrivaraTrackingStatus,
  extractTrivaraWaybillNumber,
  getTrivaraApiBaseUrl,
  getTrivaraApiKey,
  getTrivaraCrnNo,
  getTrivaraMasterApiKey,
  getTrivaraPrintSlipApiBaseUrl,
  getTrivaraServicesApiBaseUrl,
  getTrivaraTrackingApiKey,
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
  | "metadata"
>

export type TrivaraLogisticsRecord = TrivaraOrderBooking & {
  order: LogisticsOrderSummary | null
  cancellation_event: Pick<
    OrderTimeline,
    "actor" | "created_at" | "description" | "title"
  > | null
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
  syncKey?: TrivaraSyncSnapshotKey
  summary?: string
  value?: string
  detail?: string
  syncedAt?: string | null
  errorMessage?: string | null
}

function revalidateLogistics(orderId?: string) {
  revalidatePath("/admin/logistics")
  if (orderId) {
    revalidatePath(`/admin/logistics/${orderId}`)
  }
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

function getPayloadValue(
  payload: Record<string, unknown>,
  keys: string[]
): unknown {
  const queue: unknown[] = [payload]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!isObjectRecord(current)) {
      continue
    }

    for (const [key, value] of Object.entries(current)) {
      if (keys.includes(key)) {
        return value
      }

      if (isObjectRecord(value) || Array.isArray(value)) {
        queue.push(value)
      }
    }
  }

  return null
}

function getArrayCount(value: unknown): number | null {
  if (Array.isArray(value)) {
    return value.length
  }

  if (isObjectRecord(value)) {
    const nestedArray = Object.values(value).find(Array.isArray)
    return Array.isArray(nestedArray) ? nestedArray.length : null
  }

  return null
}

function getPayloadArray(
  payload: Record<string, unknown>,
  keys: string[]
): unknown[] | null {
  const value = getPayloadValue(payload, keys)

  if (Array.isArray(value)) {
    return value
  }

  if (isObjectRecord(value)) {
    const nestedArray = Object.values(value).find(Array.isArray)
    return Array.isArray(nestedArray) ? nestedArray : null
  }

  return null
}

function getRecordString(
  record: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
    if (typeof value === "number") {
      return String(value)
    }
  }

  return null
}

function getNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function formatTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getTotalOrdersDisplay(payload: Record<string, unknown>) {
  const data = getPayloadArray(payload, ["data", "orders"])

  if (data) {
    let total = 0
    const breakdown: string[] = []

    data.forEach((item) => {
      if (!isObjectRecord(item)) {
        return
      }

      const count = getNumericValue(item.counts ?? item.count ?? item.total)
      if (count === null) {
        return
      }

      total += count

      const title = getRecordString(item, ["title", "status", "name"])
      if (count > 0 && title) {
        breakdown.push(`${formatTitle(title)} ${count}`)
      }
    })

    return {
      value: String(total),
      detail: breakdown.length > 0 ? breakdown.join(", ") : "No orders in this range",
    }
  }

  const total = getPayloadValue(payload, ["total", "total_orders", "count"])
  if (typeof total === "number" || typeof total === "string") {
    return {
      value: String(total),
      detail: "Total orders",
    }
  }

  return null
}

function getPickupLocationDisplay(payload: Record<string, unknown>) {
  const locations = getPayloadArray(payload, ["data", "pickup_locations"])
  const firstLocation = locations?.find(isObjectRecord)

  if (!firstLocation) {
    return null
  }

  return {
    value:
      getRecordString(firstLocation, [
        "warehouse_name",
        "pickup_location_code",
        "location_code",
      ]) || "Pickup location synced",
    detail:
      getRecordString(firstLocation, ["address", "pincode"]) ||
      "Pickup location available",
  }
}

function getServicesDisplay(payload: Record<string, unknown>) {
  const services = getPayloadArray(payload, ["services"])
  const shipmentTypes = getPayloadArray(payload, ["shipment_type"])
  const serviceNames =
    services
      ?.filter(isObjectRecord)
      .map((item) => getRecordString(item, ["service_name", "name", "title"]))
      .filter((value): value is string => Boolean(value)) || []
  const shipmentTypeNames =
    shipmentTypes
      ?.filter(isObjectRecord)
      .map((item) =>
        getRecordString(item, ["shipment_type_name", "name", "title"])
      )
      .filter((value): value is string => Boolean(value)) || []

  if (serviceNames.length === 0 && shipmentTypeNames.length === 0) {
    return null
  }

  return {
    value: serviceNames.join(", ") || "Services synced",
    detail:
      shipmentTypeNames.length > 0
        ? `Shipment type: ${shipmentTypeNames.join(", ")}`
        : "Service options available",
  }
}

function getSnapshotDisplay(
  syncKey: TrivaraSyncSnapshotKey,
  payload: Record<string, unknown> | null
) {
  if (!payload) {
    return {
      value: "No data",
      detail: "No response stored",
    }
  }

  const display =
    syncKey === "total_orders"
      ? getTotalOrdersDisplay(payload)
      : syncKey === "pickup_locations"
        ? getPickupLocationDisplay(payload)
        : getServicesDisplay(payload)

  if (display) {
    return display
  }

  return {
    value: "Synced",
    detail: getSnapshotSummary(syncKey, payload),
  }
}

function getSnapshotSummary(
  syncKey: TrivaraSyncSnapshotKey,
  payload: Record<string, unknown> | null
) {
  if (!payload) {
    return "No response stored"
  }

  if (Object.keys(payload).length === 0) {
    return "Empty response"
  }

  const error = getPayloadString(payload, ["error", "message"])
  const result = getPayloadString(payload, ["result"])
  const success = getPayloadValue(payload, ["success"])
  const data = getPayloadValue(payload, ["data", "orders", "services"])
  const count = getArrayCount(data)

  if (error) {
    return error
  }

  if (syncKey === "total_orders") {
    if (count !== null) {
      return `${count} orders returned`
    }

    const total = getPayloadValue(payload, ["total", "total_orders", "count"])
    if (typeof total === "number" || typeof total === "string") {
      return `${total} total orders`
    }
  }

  if (syncKey === "pickup_locations" && count !== null) {
    return `${count} pickup locations returned`
  }

  if (syncKey === "services" && count !== null) {
    return `${count} services returned`
  }

  if (result) {
    return result
  }

  if (typeof success === "boolean") {
    return success ? "Synced successfully" : "Sync failed"
  }

  return "Response stored"
}

function buildSyncActionResult({
  syncKey,
  success,
  successMessage,
  failureMessage,
  responsePayload,
  errorMessage,
  syncedAt,
}: {
  syncKey: TrivaraSyncSnapshotKey
  success: boolean
  successMessage: string
  failureMessage: string
  responsePayload: Record<string, unknown> | null
  errorMessage: string | null
  syncedAt: string
}): TrivaraSyncActionResult {
  const display = getSnapshotDisplay(syncKey, responsePayload)

  return {
    success,
    message: success ? successMessage : failureMessage,
    syncKey,
    summary: errorMessage || display.detail,
    value: errorMessage ? "Failed" : display.value,
    detail: errorMessage || display.detail,
    syncedAt,
    errorMessage,
  }
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

  if (hasNestedErrorStatus(response.responsePayload)) {
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

function hasNestedErrorStatus(payload: Record<string, unknown>): boolean {
  const queue: unknown[] = [payload]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!isObjectRecord(current)) {
      continue
    }

    for (const [key, value] of Object.entries(current)) {
      if (
        key === "status" &&
        typeof value === "string" &&
        value.trim().toLowerCase() === "error"
      ) {
        return true
      }

      if (isObjectRecord(value) || Array.isArray(value)) {
        queue.push(value)
      }
    }
  }

  return false
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
  const currentPage = Math.max(1, page)
  const offset = (currentPage - 1) * limit
  const from = offset
  const to = offset + limit - 1
  const normalizedSearch = search.trim()
  const matchingOrderIds: string[] = []

  if (normalizedSearch) {
    let orderSearchQuery = supabase
      .from("orders")
      .select("id")
      .ilike("customer_email", `%${normalizedSearch}%`)

    const numericSearch = Number(normalizedSearch)
    if (Number.isInteger(numericSearch) && numericSearch > 0) {
      orderSearchQuery = supabase
        .from("orders")
        .select("id")
        .or(
          `customer_email.ilike.%${normalizedSearch}%,display_id.eq.${numericSearch}`
        )
    }

    const { data: matchingOrders, error: matchingOrdersError } =
      await orderSearchQuery

    if (matchingOrdersError) {
      throw new Error(matchingOrdersError.message)
    }

    matchingOrderIds.push(
      ...((matchingOrders || []) as Array<{ id: string }>).map((order) => order.id)
    )
  }

  const searchFilter = normalizedSearch
    ? matchingOrderIds.length > 0
      ? `trivara_reference_number.ilike.%${normalizedSearch}%,order_id.in.(${matchingOrderIds.join(",")})`
      : `trivara_reference_number.ilike.%${normalizedSearch}%`
    : ""

  let countQuery = supabase
    .from("trivara_order_bookings")
    .select("*", { count: "exact", head: true })

  if (status !== "all") {
    countQuery = countQuery.eq("status", status)
  }

  if (searchFilter) {
    countQuery = countQuery.or(searchFilter)
  }

  const { count, error: countError } = await countQuery
  if (countError) {
    throw new Error(countError.message)
  }

  let query = supabase
    .from("trivara_order_bookings")
    .select("*")
    .order("updated_at", { ascending: false })
    .range(from, to)

  if (status !== "all") {
    query = query.eq("status", status)
  }

  if (searchFilter) {
    query = query.or(searchFilter)
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
        "id, display_id, customer_email, status, payment_method, payment_status, total_amount, currency_code, created_at, shipping_address, metadata"
      )
      .in("id", orderIds)

    if (ordersError) {
      throw new Error(ordersError.message)
    }

    ;((orders || []) as LogisticsOrderSummary[]).forEach((order) => {
      ordersById.set(order.id, order)
    })
  }

  const records = bookings.map((booking) => ({
    ...booking,
    order: ordersById.get(booking.order_id) || null,
    cancellation_event: null,
  }))
  const totalCount = count || 0
  const totalPages = Math.ceil(totalCount / limit) || 1

  return {
    records,
    count: totalCount,
    totalPages,
    currentPage,
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
      "id, display_id, customer_email, status, payment_method, payment_status, total_amount, currency_code, created_at, shipping_address, metadata"
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const { data: cancellationEvent, error: cancellationEventError } =
    await supabase
      .from("order_timeline")
      .select("actor, created_at, description, title")
      .eq("order_id", orderId)
      .eq("event_type", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

  if (cancellationEventError) {
    throw new Error(cancellationEventError.message)
  }

  return {
    ...booking,
    order: order ? (order as LogisticsOrderSummary) : null,
    cancellation_event: cancellationEvent
      ? (cancellationEvent as Pick<
          OrderTimeline,
          "actor" | "created_at" | "description" | "title"
        >)
      : null,
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
  const waybill =
    extractTrivaraWaybillNumber(booking.response_payload) ||
    booking.trivara_reference_number

  if (!waybill) {
    return {
      success: false,
      message: "Trivara waybill is required before tracking.",
    }
  }

  const payload = {
    crn_no: getTrivaraCrnNo(),
    action: "track" as const,
    waybill,
  }
  try {
    const response = await sendTrivaraOrderTracking(payload, {
      apiBaseUrl: getTrivaraApiBaseUrl(),
      apiKey: getTrivaraTrackingApiKey(),
    })
    const trackingStatus = extractTrivaraTrackingStatus(response.responsePayload)

    await updateBooking(orderId, {
      tracking_payload: response.responsePayload,
      tracking_status: trackingStatus,
      tracking_synced_at: new Date().toISOString(),
    })

    revalidateLogistics(orderId)

    if (!response.ok) {
      return {
        success: false,
        message: getTrivaraResponseError(
          response,
          "Trivara tracking failed"
        ),
      }
    }

    return {
      success: true,
      message: trackingStatus
        ? `Tracking synced. Current status: ${trackingStatus}.`
        : "Tracking synced successfully.",
    }
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    }
  }
}

export async function printTrivaraSlip(orderId: string) {
  await ensureAdmin()
  await requirePermission(PERMISSIONS.SHIPPING_UPDATE)

  const booking = await getBooking(orderId)
  const referenceNumber = booking.trivara_reference_number
  const waybill =
    extractTrivaraWaybillNumber(booking.response_payload) || referenceNumber

  if (!referenceNumber || !waybill) {
    return {
      success: false,
      message: "Trivara reference number and waybill are required before printing.",
    }
  }

  const payload = {
    crn_no: getTrivaraCrnNo(),
    reference_number: referenceNumber,
    awb_number: waybill,
  }
  try {
    const response = await sendTrivaraPrintSlip(payload, {
      apiBaseUrl: getTrivaraPrintSlipApiBaseUrl(),
      apiKey: getTrivaraApiKey(),
    })

    await updateBooking(orderId, {
      print_slip_payload: response.responsePayload,
      print_slip_synced_at: new Date().toISOString(),
    })

    revalidateLogistics(orderId)

    if (!response.ok) {
      return {
        success: false,
        message: getTrivaraResponseError(
          response,
          "Trivara print slip failed"
        ),
      }
    }

    return {
      success: true,
      message: "Print slip synced successfully.",
    }
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    }
  }
}

export async function trackTrivaraOrderForForm(orderId: string): Promise<void> {
  await trackTrivaraOrder(orderId)
}

export async function printTrivaraSlipForForm(orderId: string): Promise<void> {
  await printTrivaraSlip(orderId)
}

export async function cancelTrivaraOrder(orderId: string) {
  await ensureAdmin()
  await requirePermission(PERMISSIONS.SHIPPING_UPDATE)
  await cancelOrder(orderId)
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

    const syncedAt = new Date().toISOString()

    await upsertSnapshot("pickup_locations", {
      request_payload: requestPayload,
      response_payload: response.responsePayload,
      error_message: errorMessage,
      synced_at: syncedAt,
    })

    revalidateLogistics()

    return buildSyncActionResult({
      syncKey: "pickup_locations",
      success: isSuccessful,
      successMessage: "Pickup locations synced successfully.",
      failureMessage: "Pickup locations sync failed. Check Trivara credentials.",
      responsePayload: response.responsePayload,
      errorMessage,
      syncedAt,
    })
  } catch (error) {
    const syncedAt = new Date().toISOString()
    const errorMessage = getErrorMessage(error)

    await upsertSnapshot("pickup_locations", {
      request_payload: requestPayload,
      response_payload: null,
      error_message: errorMessage,
      synced_at: syncedAt,
    })

    revalidateLogistics()

    return buildSyncActionResult({
      syncKey: "pickup_locations",
      success: false,
      successMessage: "Pickup locations synced successfully.",
      failureMessage: "Pickup locations sync failed. Check Trivara credentials.",
      responsePayload: null,
      errorMessage,
      syncedAt,
    })
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

    const syncedAt = new Date().toISOString()

    await upsertSnapshot("services", {
      request_payload: requestPayload,
      response_payload: response.responsePayload,
      error_message: errorMessage,
      synced_at: syncedAt,
    })

    revalidateLogistics()

    return buildSyncActionResult({
      syncKey: "services",
      success: isSuccessful,
      successMessage: "Services synced successfully.",
      failureMessage: "Services sync failed. Check Trivara credentials.",
      responsePayload: response.responsePayload,
      errorMessage,
      syncedAt,
    })
  } catch (error) {
    const syncedAt = new Date().toISOString()
    const errorMessage = getErrorMessage(error)

    await upsertSnapshot("services", {
      request_payload: requestPayload,
      response_payload: null,
      error_message: errorMessage,
      synced_at: syncedAt,
    })

    revalidateLogistics()

    return buildSyncActionResult({
      syncKey: "services",
      success: false,
      successMessage: "Services synced successfully.",
      failureMessage: "Services sync failed. Check Trivara credentials.",
      responsePayload: null,
      errorMessage,
      syncedAt,
    })
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

    const syncedAt = new Date().toISOString()

    await upsertSnapshot("total_orders", {
      request_payload: requestPayload,
      response_payload: response.responsePayload,
      error_message: errorMessage,
      synced_at: syncedAt,
    })

    revalidateLogistics()

    return buildSyncActionResult({
      syncKey: "total_orders",
      success: isSuccessful,
      successMessage: "Total orders synced successfully.",
      failureMessage: "Total orders sync failed. Check Trivara credentials.",
      responsePayload: response.responsePayload,
      errorMessage,
      syncedAt,
    })
  } catch (error) {
    const syncedAt = new Date().toISOString()
    const errorMessage = getErrorMessage(error)

    await upsertSnapshot("total_orders", {
      request_payload: requestPayload,
      response_payload: null,
      error_message: errorMessage,
      synced_at: syncedAt,
    })

    revalidateLogistics()

    return buildSyncActionResult({
      syncKey: "total_orders",
      success: false,
      successMessage: "Total orders synced successfully.",
      failureMessage: "Total orders sync failed. Check Trivara credentials.",
      responsePayload: null,
      errorMessage,
      syncedAt,
    })
  }
}
