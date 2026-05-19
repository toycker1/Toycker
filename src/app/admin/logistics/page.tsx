import Link from "next/link"
import { DocumentTextIcon, XCircleIcon } from "@heroicons/react/24/outline"
import AdminBadge from "@modules/admin/components/admin-badge"
import AdminCard from "@modules/admin/components/admin-card"
import AdminPageHeader from "@modules/admin/components/admin-page-header"
import { AdminPagination } from "@modules/admin/components/admin-pagination"
import { AdminSearchInput } from "@modules/admin/components/admin-search-input"
import { AdminTableWrapper } from "@modules/admin/components/admin-table-wrapper"
import { convertToLocale } from "@lib/util/money"
import { formatIST } from "@/lib/util/date"
import {
  cancelTrivaraOrder,
  getTrivaraLogisticsRecords,
  getTrivaraSyncSnapshots,
  printTrivaraSlip,
  retryTrivaraBooking,
  trackTrivaraOrder,
} from "@/lib/data/trivara-logistics"
import {
  TrivaraOrderBookingStatus,
  TrivaraSyncSnapshotKey,
} from "@/lib/supabase/types"
import { LogisticsSyncActions } from "./logistics-sync-actions"

const STATUS_FILTERS: Array<{
  label: string
  value: TrivaraOrderBookingStatus | "all"
}> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Booked", value: "booked" },
  { label: "Failed", value: "failed" },
  { label: "Skipped", value: "skipped" },
  { label: "Cancelled", value: "cancelled" },
]

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

function normalizePaymentMethod(method?: string | null) {
  const value = (method || "").toLowerCase()
  if (value.includes("cod") || value.includes("cash")) {
    return "COD"
  }
  if (value.includes("easebuzz")) {
    return "Easebuzz"
  }
  if (value.includes("payu")) {
    return "PayU"
  }
  return method || "Manual"
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
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

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
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

  const error = getStringValue(getPayloadValue(payload, ["error", "message"]))
  const result = getStringValue(getPayloadValue(payload, ["result"]))
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

export default async function AdminLogistics({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    search?: string
    status?: TrivaraOrderBookingStatus | "all"
  }>
}) {
  const {
    page = "1",
    search = "",
    status = "all",
  } = await searchParams
  const pageNumber = parseInt(page, 10) || 1
  const [{ records, count, totalPages, currentPage }, snapshots] =
    await Promise.all([
      getTrivaraLogisticsRecords({
        page: pageNumber,
        limit: 20,
        search,
        status,
      }),
      getTrivaraSyncSnapshots(),
    ])

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Logistics"
        subtitle="Manage Trivara bookings, tracking, slips, cancellation, and master syncs."
      />

      <LogisticsSyncActions />

      {snapshots.length > 0 && (
        <AdminCard title="Latest Trivara Syncs" className="p-0">
          <div className="divide-y divide-gray-100">
            {snapshots.map((snapshot) => (
              <div
                key={snapshot.sync_key}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold capitalize text-gray-900">
                    {snapshot.sync_key.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-gray-500">
                    {snapshot.error_message ||
                      getSnapshotSummary(
                        snapshot.sync_key,
                        snapshot.response_payload
                      )}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {snapshot.synced_at ? formatIST(snapshot.synced_at) : "Not synced"}
                </span>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      <AdminSearchInput
        defaultValue={search}
        basePath="/admin/logistics"
        placeholder="Search by order ID, customer email, or Trivara reference..."
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((item) => {
          const active = item.value === status
          const href =
            item.value === "all"
              ? "/admin/logistics"
              : `/admin/logistics?status=${item.value}`

          return (
            <Link
              key={item.value}
              href={href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      <div className="text-sm text-gray-500">
        Showing {count > 0 ? (currentPage - 1) * 20 + 1 : 0} to{" "}
        {Math.min(currentPage * 20, count)} of {count} logistics records
      </div>

      <AdminTableWrapper className="rounded-xl border border-admin-border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-[#f7f8f9]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Order
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Trivara
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Payment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Last Sync
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {records.map((record) => {
              const statusBadge = getStatusBadge(record.status)
              const canUseReference = Boolean(record.trivara_reference_number)
              const canRetry =
                record.status === "failed" || record.status === "skipped"
              const canCancelOrder = Boolean(
                record.order &&
                  ["pending", "order_placed", "accepted"].includes(
                    record.order.status
                  )
              )
              const canSyncTrivaraCancellation = Boolean(
                record.order &&
                  ["cancelled", "failed"].includes(record.order.status) &&
                  record.status !== "cancelled" &&
                  canUseReference
              )

              return (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <Link
                      href={`/admin/logistics/${record.order_id}`}
                      className="text-sm font-semibold text-gray-900 hover:text-indigo-600"
                    >
                      #{record.order?.display_id || record.order_id}
                    </Link>
                    <p className="mt-1 text-xs text-gray-400">
                      {record.order ? formatIST(record.order.created_at) : ""}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-700">
                      {record.order?.customer_email || "Order not found"}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {record.order?.status || ""}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <AdminBadge variant={statusBadge.variant}>
                      {statusBadge.label}
                    </AdminBadge>
                    <p className="mt-2 text-xs font-mono text-gray-500">
                      {record.trivara_reference_number || "No reference"}
                    </p>
                    {record.error_message && (
                      <p className="mt-1 max-w-xs truncate text-xs text-red-600">
                        {record.error_message}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    <p>{normalizePaymentMethod(record.order?.payment_method)}</p>
                    {record.order && (
                      <p className="mt-1 font-medium text-gray-900">
                        {convertToLocale({
                          amount: record.order.total_amount,
                          currency_code: record.order.currency_code,
                        })}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatIST(record.updated_at)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/admin/logistics/${record.order_id}`}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                      >
                        View
                      </Link>
                      {canRetry && (
                        <form action={retryTrivaraBooking.bind(null, record.order_id)}>
                          <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                            Retry
                          </button>
                        </form>
                      )}
                      {canUseReference && (
                        <>
                          <form action={trackTrivaraOrder.bind(null, record.order_id)}>
                            <button className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200">
                              Track
                            </button>
                          </form>
                          <form action={printTrivaraSlip.bind(null, record.order_id)}>
                            <button className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200">
                              <DocumentTextIcon className="h-3.5 w-3.5" />
                              Slip
                            </button>
                          </form>
                        </>
                      )}
                      {(canCancelOrder || canSyncTrivaraCancellation) && (
                        <form action={cancelTrivaraOrder.bind(null, record.order_id)}>
                          <button className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
                            <XCircleIcon className="h-3.5 w-3.5" />
                            {canCancelOrder ? "Cancel Order" : "Cancel Trivara"}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-sm text-gray-500">
                  No Trivara logistics records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </AdminTableWrapper>

      <AdminPagination currentPage={currentPage} totalPages={totalPages} />
    </div>
  )
}
