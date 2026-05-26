import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ClockIcon,
  CubeIcon,
  DocumentArrowDownIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"
import AdminBadge from "@modules/admin/components/admin-badge"
import AdminCard from "@modules/admin/components/admin-card"
import { convertToLocale } from "@lib/util/money"
import { formatIST } from "@/lib/util/date"
import {
  cancelTrivaraOrder,
  getTrivaraLogisticsRecord,
  retryTrivaraBooking,
} from "@/lib/data/trivara-logistics"
import {
  extractTrivaraTrackingStatus,
  extractTrivaraWaybillNumber,
} from "@/lib/integrations/trivara"
import { TrivaraOrderBookingStatus } from "@/lib/supabase/types"
import { LogisticsDetailActions } from "./logistics-detail-actions"
import {
  getPaymentMethodDisplay,
  getPaymentStatusDisplay,
  isPartialPaymentMethod,
} from "@/lib/util/payment-status"
import { getPartialPaymentDisplayData } from "@/lib/util/order-pricing"

type Props = {
  params: Promise<{ orderId: string }>
}

function getStatusBadge(status: TrivaraOrderBookingStatus) {
  switch (status) {
    case "booked":
      return { variant: "success" as const, label: "Booked" }
    case "pending":
      return { variant: "info" as const, label: "Pending" }
    case "failed":
      return { variant: "error" as const, label: "Failed" }
    case "skipped":
      return { variant: "warning" as const, label: "Skipped" }
    case "cancelled":
      return { variant: "neutral" as const, label: "Cancelled" }
  }
}

function formatStatusLabel(value: string | null | undefined): string {
  if (!value) {
    return "-"
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getTrackingBadgeVariant(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase() || ""

  if (!normalized) {
    return "neutral" as const
  }

  if (
    [
      "success",
      "booked",
      "manifested",
      "pickup",
      "picked up",
      "in transit",
      "out for delivery",
      "delivered",
      "order created",
    ].includes(normalized)
  ) {
    return "success" as const
  }

  if (["cancelled", "canceled", "rto delivered"].includes(normalized)) {
    return "neutral" as const
  }

  if (
    [
      "failed",
      "fail",
      "error",
      "lost",
      "forward failed",
      "cancel failed",
    ].includes(normalized)
  ) {
    return "error" as const
  }

  if (["pending", "processing"].includes(normalized)) {
    return "info" as const
  }

  return "warning" as const
}

function getCurrentTrivaraStatus(
  record: Awaited<ReturnType<typeof getTrivaraLogisticsRecord>>
): string | null {
  if (!record) {
    return null
  }

  const trackingStatus =
    record.tracking_status || extractTrivaraTrackingStatus(record.tracking_payload)

  if (trackingStatus) {
    return trackingStatus
  }

  if (record.status === "booked") {
    return "Booked"
  }

  if (record.status === "cancelled") {
    return "Cancelled"
  }

  if (record.status === "failed") {
    return record.error_message || "Failed"
  }

  if (record.status === "pending") {
    return "Pending"
  }

  return "Skipped"
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-3 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">
        {value || "-"}
      </span>
    </div>
  )
}

function DiagnosticCell({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-gray-900">
        {value || "-"}
      </p>
    </div>
  )
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function asDisplayValue(value: unknown): string | number | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  if (typeof value === "number") {
    return value
  }

  return null
}

function getPayloadValue(
  payload: Record<string, unknown> | null,
  keys: string[]
): unknown {
  const queue: unknown[] = payload ? [payload] : []

  while (queue.length > 0) {
    const current = queue.shift()

    if (Array.isArray(current)) {
      queue.push(...current)
      continue
    }

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

function getPayloadNumberOrString(
  payload: Record<string, unknown> | null,
  keys: string[]
): string | number | null {
  const value = getPayloadValue(payload, keys)
  return asDisplayValue(value)
}

function formatCurrencyDiagnostic(
  amount: number | null | undefined,
  currencyCode: string | null | undefined
): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return null
  }

  return convertToLocale({
    amount,
    currency_code: currencyCode || "inr",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function toDiagnosticNumber(value: string | number | null): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getDimensions(payload: Record<string, unknown> | null): string | null {
  const length = getPayloadNumberOrString(payload, ["length"])
  const width = getPayloadNumberOrString(payload, ["width"])
  const height = getPayloadNumberOrString(payload, ["height"])

  if (!length || !width || !height) {
    return null
  }

  return `${length} x ${width} x ${height} cm`
}

function getWeight(payload: Record<string, unknown> | null): string | null {
  const weight = getPayloadNumberOrString(payload, ["weight"])
  return weight ? `${weight} g` : null
}

function getTrivaraErrorHelp(errorMessage: string | null): string | null {
  if (!errorMessage) {
    return null
  }

  if (errorMessage.trim().toLowerCase() !== "forward failed") {
    return null
  }

  return "Trivara processed the request, but the downstream courier forward booking failed. Ask Trivara to check Delhivery forward/COD serviceability, warehouse mapping, and the hidden courier rejection reason."
}

function getFirstDataRecord(
  payload: Record<string, unknown> | null
): Record<string, unknown> | null {
  const data = payload?.data

  if (Array.isArray(data)) {
    const firstRecord = data.find(isObjectRecord)
    return firstRecord || null
  }

  if (isObjectRecord(data)) {
    return data
  }

  return null
}

function getRecordValue(
  record: Record<string, unknown> | null,
  keys: string[]
): string | number | null {
  if (!record) {
    return null
  }

  for (const key of keys) {
    const value = asDisplayValue(record[key])

    if (value !== null) {
      return value
    }
  }

  return null
}

function getBookingResult(payload: Record<string, unknown> | null) {
  const data = getFirstDataRecord(payload)

  return {
    status: getRecordValue(data, ["status"]),
    message: getRecordValue(data, ["message"]),
    trivaraOrderId: getRecordValue(data, ["order_id"]),
    result: getRecordValue(payload, ["result"]),
  }
}

function getPrintSlipUrl(payload: Record<string, unknown> | null): string | null {
  const data = getFirstDataRecord(payload)
  const url = getRecordValue(data, ["url"])

  return typeof url === "string" ? url : null
}

function getPrintSlipResult(payload: Record<string, unknown> | null) {
  return {
    result: getRecordValue(payload, ["result"]),
    url: getPrintSlipUrl(payload),
  }
}

function getCancelResult(payload: Record<string, unknown> | null) {
  const data = getFirstDataRecord(payload)

  return {
    status: getRecordValue(data, ["status"]),
    message: getRecordValue(data, ["message"]),
    result: getRecordValue(payload, ["result"]),
  }
}

function getRequestOrder(
  payload: Record<string, unknown> | null
): Record<string, unknown> | null {
  const orders = payload?.orders

  if (!Array.isArray(orders)) {
    return null
  }

  const firstOrder = orders.find(isObjectRecord)
  return firstOrder || null
}

type PackageItemView = {
  sku: string | number | null
  name: string
  quantity: string | number | null
  amount: string | number | null
}

function getPackageItems(
  payload: Record<string, unknown> | null
): PackageItemView[] {
  const order = getRequestOrder(payload)
  const items = order?.items

  if (!Array.isArray(items)) {
    return []
  }

  return items.filter(isObjectRecord).map((item, index) => {
    const name = getRecordValue(item, ["product_detail"])

    return {
      sku: getRecordValue(item, ["product_sku", "sku"]),
      name: typeof name === "string" ? name : `Item ${index + 1}`,
      quantity: getRecordValue(item, ["quantity"]),
      amount: getRecordValue(item, ["package_amount"]),
    }
  })
}

type TrackingEventView = {
  dateTime: string | number | null
  instruction: string
  location: string | number | null
}

function getTrackingEvents(
  payload: Record<string, unknown> | null
): TrackingEventView[] {
  const history = payload?.tracking_history

  if (!Array.isArray(history)) {
    return []
  }

  return history.filter(isObjectRecord).map((event) => {
    const instruction = getRecordValue(event, [
      "Instructions",
      "instructions",
      "status",
      "current_state",
    ])

    return {
      dateTime: getRecordValue(event, ["date_time", "dateTime", "created_at"]),
      instruction: typeof instruction === "string" ? instruction : "Tracking update",
      location: getRecordValue(event, [
        "ScannedLocation",
        "scanned_location",
        "location",
      ]),
    }
  })
}

function getTrackingOrderDetails(
  payload: Record<string, unknown> | null
): Record<string, unknown> | null {
  const orderDetails = payload?.order_details
  return isObjectRecord(orderDetails) ? orderDetails : null
}

function getTrackingCancelledLabel(
  payload: Record<string, unknown> | null
): string | number | null {
  return getRecordValue(getTrackingOrderDetails(payload), ["is_cancelled"])
}

function isTrivaraTrackingCancelled(
  payload: Record<string, unknown> | null,
  currentStatus: string | null
): boolean {
  const cancelledValue = getTrackingCancelledLabel(payload)
  const normalizedCancelledValue = String(cancelledValue || "")
    .trim()
    .toLowerCase()
  const normalizedStatus = String(currentStatus || "").trim().toLowerCase()

  return (
    ["yes", "true", "1"].includes(normalizedCancelledValue) ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "canceled"
  )
}

function isAdminCancellationEvent(
  event: NonNullable<
    Awaited<ReturnType<typeof getTrivaraLogisticsRecord>>
  >["cancellation_event"]
): boolean {
  if (!event) {
    return false
  }

  const actor = event.actor.trim().toLowerCase()
  const description = String(event.description || "").trim().toLowerCase()
  const title = event.title.trim().toLowerCase()

  return (
    description.includes("cancelled by admin") ||
    description.includes("canceled by admin") ||
    (title.includes("order cancelled") &&
      actor !== "customer" &&
      actor !== "system")
  )
}

type CancellationSourceView = {
  label: "Cancelled by Admin" | "Cancelled by Trivara" | "Not cancelled"
  detail: string | null
  occurredAt: string | null
  variant: "neutral" | "warning" | "info"
}

function getCancellationSource(
  record: NonNullable<Awaited<ReturnType<typeof getTrivaraLogisticsRecord>>>,
  currentStatus: string | null
): CancellationSourceView {
  const adminEvent = record.cancellation_event
  const hasAdminCancellation =
    Boolean(record.cancelled_at) || isAdminCancellationEvent(adminEvent)

  if (hasAdminCancellation) {
    return {
      label: "Cancelled by Admin",
      detail: adminEvent?.actor ? `Actor: ${adminEvent.actor}` : null,
      occurredAt: adminEvent?.created_at || record.cancelled_at,
      variant: "neutral",
    }
  }

  if (isTrivaraTrackingCancelled(record.tracking_payload, currentStatus)) {
    return {
      label: "Cancelled by Trivara",
      detail: "Cancellation is present in Trivara tracking data.",
      occurredAt: record.tracking_synced_at,
      variant: "warning",
    }
  }

  return {
    label: "Not cancelled",
    detail: null,
    occurredAt: null,
    variant: "info",
  }
}

function moneyValue(value: string | number | null): string {
  if (typeof value === "number") {
    return `₹${value}`
  }

  return value ? `₹${value}` : "-"
}

function ResultMetric({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold text-gray-900">
        {value ?? "-"}
      </div>
    </div>
  )
}

function PackageItemsCard({ items }: { items: PackageItemView[] }) {
  return (
    <AdminCard title="Package Details">
      {items.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {items.map((item, index) => (
            <div
              key={`${item.sku || "item"}-${index}`}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-start md:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                  <CubeIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-gray-900">
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    SKU: {item.sku || "-"} · Qty: {item.quantity || "-"}
                  </p>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {moneyValue(item.amount)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Package item details are not available in the booking request.
        </p>
      )}
    </AdminCard>
  )
}

function TrackingTimelineCard({
  currentStatus,
  events,
  lastSyncedAt,
  cancellationSource,
}: {
  currentStatus: string | null
  events: TrackingEventView[]
  lastSyncedAt: string | null
  cancellationSource: CancellationSourceView
}) {
  return (
    <AdminCard title="Tracking">
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ResultMetric
          label="Current status"
          value={
            <AdminBadge variant={getTrackingBadgeVariant(currentStatus)}>
              {formatStatusLabel(currentStatus)}
            </AdminBadge>
          }
        />
        <ResultMetric
          label="Last synced"
          value={lastSyncedAt ? formatIST(lastSyncedAt) : null}
        />
        <ResultMetric label="Tracking updates" value={events.length} />
        <ResultMetric
          label="Cancellation source"
          value={
            <div className="space-y-1">
              <AdminBadge variant={cancellationSource.variant}>
                {cancellationSource.label}
              </AdminBadge>
              {(cancellationSource.occurredAt || cancellationSource.detail) && (
                <p className="text-xs font-normal text-gray-500">
                  {[
                    cancellationSource.occurredAt
                      ? formatIST(cancellationSource.occurredAt)
                      : null,
                    cancellationSource.detail,
                  ]
                    .filter((value): value is string => Boolean(value))
                    .join(" · ")}
                </p>
              )}
            </div>
          }
        />
      </div>
    </AdminCard>
  )
}

function TrackingActivityCard({ events }: { events: TrackingEventView[] }) {
  return (
    <AdminCard title="Tracking Activity">
      {events.length > 0 ? (
        <div className="space-y-4">
          {events.map((event, index) => (
            <div key={`${event.dateTime || "event"}-${index}`} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                <ClockIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <p className="break-words text-sm font-semibold text-gray-900">
                  {event.instruction}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {event.dateTime || "Time not available"}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Tracking history has not been synced yet. Use Track after Trivara creates
          updates for this shipment.
        </p>
      )}
    </AdminCard>
  )
}

function PrintSlipCard({
  printSlip,
  syncedAt,
}: {
  printSlip: ReturnType<typeof getPrintSlipResult>
  syncedAt: string | null
}) {
  return (
    <AdminCard title="Documents">
      <div className="flex flex-col gap-4 rounded-lg border border-gray-100 bg-gray-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <DocumentArrowDownIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Print slip</p>
            <p className="mt-1 text-xs text-gray-500">
              {syncedAt ? `Synced ${formatIST(syncedAt)}` : "Not synced yet"}
            </p>
            {printSlip.result && (
              <p className="mt-1 text-xs text-gray-500">
                Result: {printSlip.result}
              </p>
            )}
          </div>
        </div>
        {printSlip.url ? (
          <a
            href={printSlip.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
          >
            Open PDF
          </a>
        ) : (
          <span className="text-sm text-gray-500">No PDF available</span>
        )}
      </div>
    </AdminCard>
  )
}

export default async function AdminLogisticsDetail({ params }: Props) {
  const { orderId } = await params
  const record = await getTrivaraLogisticsRecord(orderId)

  if (!record) {
    notFound()
  }

  const statusBadge = getStatusBadge(record.status)
  const canRetry = record.status === "failed" || record.status === "skipped"
  const hasReference = Boolean(record.trivara_reference_number)
  const waybill = extractTrivaraWaybillNumber(record.response_payload)
  const currentTrivaraStatus = getCurrentTrivaraStatus(record)
  const trivaraErrorHelp = getTrivaraErrorHelp(record.error_message)
  const bookingResult = getBookingResult(record.response_payload)
  const printSlip = getPrintSlipResult(record.print_slip_payload)
  const cancelResult = getCancelResult(record.cancel_payload)
  const packageItems = getPackageItems(record.request_payload)
  const trackingEvents = getTrackingEvents(record.tracking_payload)
  const cancellationSource = getCancellationSource(record, currentTrivaraStatus)
  const orderPaymentStatus = record.order
    ? getPaymentStatusDisplay({
        paymentStatus: record.order.payment_status,
        paymentMethod: record.order.payment_method,
        orderStatus: record.order.status,
      })
    : null
  const partialPaymentData = record.order
    ? getPartialPaymentDisplayData(record.order.metadata)
    : null
  const diagnosticBillAmount = record.order
    ? formatCurrencyDiagnostic(
        record.order.total_amount,
        record.order.currency_code
      )
    : null
  const payloadCodAmount = toDiagnosticNumber(
    getPayloadNumberOrString(record.request_payload, ["total_cod_amount"])
  )
  const diagnosticCodAmount =
    record.order &&
    isPartialPaymentMethod(record.order.payment_method) &&
    partialPaymentData?.balancePaymentStatus === "pending"
      ? formatCurrencyDiagnostic(
          partialPaymentData.balanceRemainingAmount,
          record.order.currency_code
        )
      : record.order &&
          (record.order.payment_method || "").toLowerCase().includes("cash")
        ? formatCurrencyDiagnostic(
            record.order.total_amount,
            record.order.currency_code
          )
        : formatCurrencyDiagnostic(
            payloadCodAmount,
            record.order?.currency_code
          )
  const canCancelOrder = Boolean(
    record.order &&
      ["pending", "order_placed", "accepted"].includes(record.order.status)
  )
  const canSyncTrivaraCancellation = Boolean(
    record.order &&
      ["cancelled", "failed"].includes(record.order.status) &&
      record.status !== "cancelled" &&
      hasReference
  )

  return (
    <div className="space-y-6">
      <nav className="flex items-center text-xs font-bold uppercase tracking-widest text-gray-400">
        <Link
          href="/admin/logistics"
          className="flex items-center transition-colors hover:text-black"
        >
          <ChevronLeftIcon className="mr-1 h-3 w-3" strokeWidth={3} />
          Back to Logistics
        </Link>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tighter text-gray-900">
              Logistics #{record.order?.display_id || record.order_id}
            </h1>
            <AdminBadge variant={statusBadge.variant}>{statusBadge.label}</AdminBadge>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Trivara reference:{" "}
            <span className="font-mono text-gray-800">
              {record.trivara_reference_number || "Not available"}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canRetry && (
            <form action={retryTrivaraBooking.bind(null, record.order_id)}>
              <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
                <ArrowPathIcon className="h-4 w-4" />
                Retry Booking
              </button>
            </form>
          )}
          {hasReference && <LogisticsDetailActions orderId={record.order_id} />}
          {(canCancelOrder || canSyncTrivaraCancellation) && (
            <form action={cancelTrivaraOrder.bind(null, record.order_id)}>
              <button className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">
                <XCircleIcon className="h-4 w-4" />
                {canCancelOrder ? "Cancel Order" : "Cancel Trivara"}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AdminCard title="Logistics Details">
          <DetailRow
            label="Booking status"
            value={<AdminBadge variant={statusBadge.variant}>{statusBadge.label}</AdminBadge>}
          />
          <DetailRow
            label="Reference"
            value={record.trivara_reference_number}
          />
          <DetailRow label="Waybill / AWB" value={waybill} />
          <DetailRow
            label="Booked"
            value={record.booked_at ? formatIST(record.booked_at) : null}
          />
          <DetailRow
            label="Slip synced"
            value={
              record.print_slip_synced_at
                ? formatIST(record.print_slip_synced_at)
                : null
            }
          />
          <DetailRow
            label="Cancelled"
            value={record.cancelled_at ? formatIST(record.cancelled_at) : null}
          />
        </AdminCard>

        <AdminCard title="Toycker Order">
          <DetailRow
            label="Order"
            value={record.order ? `#${record.order.display_id}` : record.order_id}
          />
          <DetailRow label="Customer" value={record.order?.customer_email} />
          <DetailRow label="Order status" value={record.order?.status} />
          <DetailRow
            label="Payment"
            value={
              record.order
                ? `${getPaymentMethodDisplay(record.order.payment_method)}${
                    orderPaymentStatus ? ` - ${orderPaymentStatus.label}` : ""
                  }`
                : null
            }
          />
          <DetailRow
            label="Total"
            value={
              record.order
                ? convertToLocale({
                    amount: record.order.total_amount,
                    currency_code: record.order.currency_code,
                  })
                : null
            }
          />
        </AdminCard>

        <AdminCard title="Delivery Address">
          <DetailRow
            label="Name"
            value={`${record.order?.shipping_address?.first_name || ""} ${
              record.order?.shipping_address?.last_name || ""
            }`.trim()}
          />
          <DetailRow
            label="Address"
            value={[
              record.order?.shipping_address?.address_1,
              record.order?.shipping_address?.address_2,
            ]
              .filter((value): value is string => Boolean(value))
              .join(", ")}
          />
          <DetailRow label="City" value={record.order?.shipping_address?.city} />
          <DetailRow
            label="State"
            value={record.order?.shipping_address?.province}
          />
          <DetailRow
            label="Pincode"
            value={record.order?.shipping_address?.postal_code}
          />
          <DetailRow label="Phone" value={record.order?.shipping_address?.phone} />
        </AdminCard>
      </div>

      <AdminCard title="Booking Diagnostics">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DiagnosticCell
            label="CRN"
            value={getPayloadNumberOrString(record.request_payload, ["crn_no"])}
          />
          <DiagnosticCell
            label="Warehouse"
            value={getPayloadNumberOrString(record.request_payload, [
              "warehouse_name",
            ])}
          />
          <DiagnosticCell
            label="Service partner ID"
            value={getPayloadNumberOrString(record.request_payload, [
              "service_partner_id",
            ])}
          />
          <DiagnosticCell
            label="Service"
            value={getPayloadNumberOrString(record.request_payload, ["service"])}
          />
          <DiagnosticCell
            label="Shipment type"
            value={getPayloadNumberOrString(record.request_payload, [
              "shipment_type",
            ])}
          />
          <DiagnosticCell
            label="Payment mode"
            value={getPayloadNumberOrString(record.request_payload, [
              "payment_mode",
            ])}
          />
          <DiagnosticCell
            label="Bill amount sent"
            value={
              diagnosticBillAmount ??
              getPayloadNumberOrString(record.request_payload, ["total_amount"])
            }
          />
          <DiagnosticCell
            label="COD collection amount"
            value={
              diagnosticCodAmount ??
              getPayloadNumberOrString(record.request_payload, [
                "total_cod_amount",
              ])
            }
          />
          <DiagnosticCell
            label="Delivery pincode"
            value={getPayloadNumberOrString(record.request_payload, ["pincode"])}
          />
          <DiagnosticCell
            label="Weight"
            value={getWeight(record.request_payload)}
          />
          <DiagnosticCell
            label="Dimensions"
            value={getDimensions(record.request_payload)}
          />
        </div>
      </AdminCard>

      {(record.error_message || record.cancel_error_message) && (
        <AdminCard title="Errors">
          {record.error_message && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-700">
                {record.error_message}
              </p>
              {trivaraErrorHelp && (
                <p className="text-sm leading-6 text-gray-600">
                  {trivaraErrorHelp}
                </p>
              )}
            </div>
          )}
          {record.cancel_error_message && (
            <p className="mt-2 text-sm text-red-700">
              {record.cancel_error_message}
            </p>
          )}
        </AdminCard>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AdminCard title="Booking Result">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ResultMetric
              label="Trivara response"
              value={
                bookingResult.status ? (
                  <AdminBadge variant={getTrackingBadgeVariant(String(bookingResult.status))}>
                    {formatStatusLabel(String(bookingResult.status))}
                  </AdminBadge>
                ) : null
              }
            />
            <ResultMetric label="Message" value={bookingResult.message} />
            <ResultMetric
              label="Trivara order ID"
              value={bookingResult.trivaraOrderId}
            />
            <ResultMetric label="Result" value={bookingResult.result} />
          </div>
        </AdminCard>

        <TrackingTimelineCard
          currentStatus={currentTrivaraStatus}
          events={trackingEvents}
          lastSyncedAt={record.tracking_synced_at}
          cancellationSource={cancellationSource}
        />
        <TrackingActivityCard events={trackingEvents} />
        <PackageItemsCard items={packageItems} />
        <PrintSlipCard
          printSlip={printSlip}
          syncedAt={record.print_slip_synced_at}
        />
        {(cancelResult.status || cancelResult.message || cancelResult.result) && (
          <AdminCard title="Cancellation Result">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ResultMetric
                label="Status"
                value={
                  cancelResult.status ? (
                    <AdminBadge
                      variant={getTrackingBadgeVariant(String(cancelResult.status))}
                    >
                      {formatStatusLabel(String(cancelResult.status))}
                    </AdminBadge>
                  ) : null
                }
              />
              <ResultMetric label="Message" value={cancelResult.message} />
              <ResultMetric label="Result" value={cancelResult.result} />
            </div>
          </AdminCard>
        )}
      </div>
    </div>
  )
}
