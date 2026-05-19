import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  DocumentTextIcon,
  TruckIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"
import AdminBadge from "@modules/admin/components/admin-badge"
import AdminCard from "@modules/admin/components/admin-card"
import { convertToLocale } from "@lib/util/money"
import { formatIST } from "@/lib/util/date"
import {
  cancelTrivaraOrder,
  getTrivaraLogisticsRecord,
  printTrivaraSlip,
  retryTrivaraBooking,
  trackTrivaraOrder,
} from "@/lib/data/trivara-logistics"
import { TrivaraOrderBookingStatus } from "@/lib/supabase/types"

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

function JsonBlock({
  title,
  value,
}: {
  title: string
  value: Record<string, unknown> | null
}) {
  return (
    <AdminCard title={title} className="p-0">
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words bg-gray-950 p-5 text-xs leading-relaxed text-gray-100">
        {JSON.stringify(value || {}, null, 2)}
      </pre>
    </AdminCard>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
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

  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  if (typeof value === "number") {
    return value
  }

  return null
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

export default async function AdminLogisticsDetail({ params }: Props) {
  const { orderId } = await params
  const record = await getTrivaraLogisticsRecord(orderId)

  if (!record) {
    notFound()
  }

  const statusBadge = getStatusBadge(record.status)
  const canRetry = record.status === "failed" || record.status === "skipped"
  const hasReference = Boolean(record.trivara_reference_number)
  const trivaraErrorHelp = getTrivaraErrorHelp(record.error_message)
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
          {hasReference && (
            <>
              <form action={trackTrivaraOrder.bind(null, record.order_id)}>
                <button className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black">
                  <TruckIcon className="h-4 w-4" />
                  Track
                </button>
              </form>
              <form action={printTrivaraSlip.bind(null, record.order_id)}>
                <button className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200">
                  <DocumentTextIcon className="h-4 w-4" />
                  Print Slip
                </button>
              </form>
            </>
          )}
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
        <AdminCard title="Shipment">
          <DetailRow label="Booking status" value={statusBadge.label} />
          <DetailRow
            label="Reference"
            value={record.trivara_reference_number}
          />
          <DetailRow label="Tracking status" value={record.tracking_status} />
          <DetailRow
            label="Booked"
            value={record.booked_at ? formatIST(record.booked_at) : null}
          />
          <DetailRow
            label="Tracking synced"
            value={
              record.tracking_synced_at
                ? formatIST(record.tracking_synced_at)
                : null
            }
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
          <DetailRow label="Payment" value={record.order?.payment_method} />
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
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <DetailRow
            label="CRN"
            value={getPayloadNumberOrString(record.request_payload, ["crn_no"])}
          />
          <DetailRow
            label="Warehouse"
            value={getPayloadNumberOrString(record.request_payload, [
              "warehouse_name",
            ])}
          />
          <DetailRow
            label="Service partner ID"
            value={getPayloadNumberOrString(record.request_payload, [
              "service_partner_id",
            ])}
          />
          <DetailRow
            label="Service"
            value={getPayloadNumberOrString(record.request_payload, ["service"])}
          />
          <DetailRow
            label="Shipment type"
            value={getPayloadNumberOrString(record.request_payload, [
              "shipment_type",
            ])}
          />
          <DetailRow
            label="Payment mode"
            value={getPayloadNumberOrString(record.request_payload, [
              "payment_mode",
            ])}
          />
          <DetailRow
            label="Delivery pincode"
            value={getPayloadNumberOrString(record.request_payload, ["pincode"])}
          />
          <DetailRow
            label="Weight"
            value={getWeight(record.request_payload)}
          />
          <DetailRow
            label="Dimensions"
            value={getDimensions(record.request_payload)}
          />
          <DetailRow
            label="COD amount"
            value={getPayloadNumberOrString(record.request_payload, [
              "total_cod_amount",
            ])}
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
        <JsonBlock title="Booking Request" value={record.request_payload} />
        <JsonBlock title="Booking Response" value={record.response_payload} />
        <JsonBlock title="Tracking Response" value={record.tracking_payload} />
        <JsonBlock title="Print Slip Response" value={record.print_slip_payload} />
        <JsonBlock title="Cancel Response" value={record.cancel_payload} />
      </div>
    </div>
  )
}
