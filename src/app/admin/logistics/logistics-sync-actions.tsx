"use client"

import type React from "react"
import { useState, useTransition } from "react"
import {
  ArrowPathIcon,
  MapPinIcon,
  TruckIcon,
} from "@heroicons/react/24/outline"
import AdminBadge from "@modules/admin/components/admin-badge"
import AdminCard from "@modules/admin/components/admin-card"
import { useOptionalToast } from "@modules/common/context/toast-context"
import { formatIST } from "@/lib/util/date"
import {
  syncTrivaraPickupLocations,
  syncTrivaraServices,
  syncTrivaraTotalOrders,
} from "@/lib/data/trivara-logistics"
import type { TrivaraSyncActionResult } from "@/lib/data/trivara-logistics"
import type {
  TrivaraSyncSnapshot,
  TrivaraSyncSnapshotKey,
} from "@/lib/supabase/types"

type SyncDisplayState = {
  success: boolean | null
  summary: string
  value: string
  detail: string
  syncedAt: string | null
}

type SyncActionConfig = {
  syncKey: TrivaraSyncSnapshotKey
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  buttonLabel: string
}

const SYNC_ACTIONS: SyncActionConfig[] = [
  {
    syncKey: "pickup_locations",
    title: "Pickup Locations",
    description: "Sync pickup location codes from Trivara.",
    icon: MapPinIcon,
    buttonLabel: "Sync Locations",
  },
  {
    syncKey: "services",
    title: "Services",
    description: "Sync service options available for this CRN.",
    icon: TruckIcon,
    buttonLabel: "Sync Services",
  },
  {
    syncKey: "total_orders",
    title: "Total Orders",
    description: "Sync order totals from Trivara for the selected date range.",
    icon: ArrowPathIcon,
    buttonLabel: "Sync Total Orders",
  },
]

function SyncButton({
  children,
  isPending,
  onClick,
}: {
  children: React.ReactNode
  isPending: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? "Syncing..." : children}
    </button>
  )
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

function getInitialSyncState(
  syncKey: TrivaraSyncSnapshotKey,
  snapshots: TrivaraSyncSnapshot[]
): SyncDisplayState {
  const snapshot = snapshots.find((item) => item.sync_key === syncKey)

  if (!snapshot) {
    return {
      success: null,
      summary: "Not synced yet",
      value: "Not synced",
      detail: "No sync has been run yet",
      syncedAt: null,
    }
  }

  const display = getSnapshotDisplay(snapshot.sync_key, snapshot.response_payload)
  const detail = snapshot.error_message || display.detail

  return {
    success: !snapshot.error_message,
    summary: detail,
    value: snapshot.error_message ? "Failed" : display.value,
    detail,
    syncedAt: snapshot.synced_at,
  }
}

function getStatusBadge(syncState: SyncDisplayState, isPending: boolean) {
  if (isPending) {
    return <AdminBadge variant="info">Syncing</AdminBadge>
  }

  if (syncState.success === true) {
    return <AdminBadge variant="success">Success</AdminBadge>
  }

  if (syncState.success === false) {
    return <AdminBadge variant="error">Failed</AdminBadge>
  }

  return <AdminBadge variant="neutral">Not synced</AdminBadge>
}

function useSyncToast() {
  const toast = useOptionalToast()

  return (result: TrivaraSyncActionResult) => {
    toast?.showToast(result.message, result.success ? "success" : "error")
  }
}

export function LogisticsSyncActions({
  initialSnapshots,
}: {
  initialSnapshots: TrivaraSyncSnapshot[]
}) {
  const [isLocationsPending, startLocationsTransition] = useTransition()
  const [isServicesPending, startServicesTransition] = useTransition()
  const [isTotalOrdersPending, startTotalOrdersTransition] = useTransition()
  const [syncStates, setSyncStates] = useState<
    Record<TrivaraSyncSnapshotKey, SyncDisplayState>
  >(() => ({
    pickup_locations: getInitialSyncState("pickup_locations", initialSnapshots),
    services: getInitialSyncState("services", initialSnapshots),
    total_orders: getInitialSyncState("total_orders", initialSnapshots),
  }))
  const [startDate, setStartDate] = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    return `${today.slice(0, 8)}01`
  })
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const showSyncToast = useSyncToast()

  const updateSyncState = (result: TrivaraSyncActionResult) => {
    if (!result.syncKey || !result.summary) {
      return
    }

    const syncKey = result.syncKey
    const summary = result.summary

    setSyncStates((current) => ({
      ...current,
      [syncKey]: {
        success: result.success,
        summary,
        value: result.value || (result.success ? "Synced" : "Failed"),
        detail: result.detail || summary,
        syncedAt: result.syncedAt ?? new Date().toISOString(),
      },
    }))
  }

  const handlePickupLocationsSync = () => {
    startLocationsTransition(async () => {
      try {
        const result = await syncTrivaraPickupLocations()
        updateSyncState(result)
        showSyncToast(result)
      } catch {
        showSyncToast({
          success: false,
          message: "Pickup locations sync failed. Please try again.",
        })
      }
    })
  }

  const handleServicesSync = () => {
    startServicesTransition(async () => {
      try {
        const result = await syncTrivaraServices()
        updateSyncState(result)
        showSyncToast(result)
      } catch {
        showSyncToast({
          success: false,
          message: "Services sync failed. Please try again.",
        })
      }
    })
  }

  const handleTotalOrdersSync = () => {
    startTotalOrdersTransition(async () => {
      const formData = new FormData()
      formData.set("start_date", startDate)
      formData.set("end_date", endDate)
      try {
        const result = await syncTrivaraTotalOrders(formData)
        updateSyncState(result)
        showSyncToast(result)
      } catch {
        showSyncToast({
          success: false,
          message: "Total orders sync failed. Please try again.",
        })
      }
    })
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {SYNC_ACTIONS.map((action) => {
          const Icon = action.icon
          const isPending =
            action.syncKey === "pickup_locations"
              ? isLocationsPending
              : action.syncKey === "services"
                ? isServicesPending
                : isTotalOrdersPending
          const syncState = syncStates[action.syncKey]
          const handleSync =
            action.syncKey === "pickup_locations"
              ? handlePickupLocationsSync
              : action.syncKey === "services"
                ? handleServicesSync
                : handleTotalOrdersSync

          return (
            <AdminCard key={action.syncKey} title={action.title}>
              <div className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  {getStatusBadge(syncState, isPending)}
                </div>

                <div className="min-w-0" role="status" aria-live="polite">
                  <p className="truncate text-2xl font-semibold text-gray-900">
                    {isPending ? "Syncing..." : syncState.value}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {isPending ? "Sync request is running..." : syncState.detail}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    Last synced:{" "}
                    {syncState.syncedAt ? formatIST(syncState.syncedAt) : "Not synced"}
                  </p>
                </div>

                <div className="mt-auto space-y-3">
                  {action.syncKey === "total_orders" && (
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                      />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                      />
                    </div>
                  )}
                  <SyncButton isPending={isPending} onClick={handleSync}>
                    <Icon className="h-4 w-4" />
                    {action.buttonLabel}
                  </SyncButton>
                </div>
              </div>
            </AdminCard>
          )
        })}
    </div>
  )
}
