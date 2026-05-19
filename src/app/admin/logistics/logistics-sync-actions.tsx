"use client"

import type React from "react"
import { useState, useTransition } from "react"
import {
  ArrowPathIcon,
  MapPinIcon,
  TruckIcon,
} from "@heroicons/react/24/outline"
import AdminCard from "@modules/admin/components/admin-card"
import { useOptionalToast } from "@modules/common/context/toast-context"
import {
  syncTrivaraPickupLocations,
  syncTrivaraServices,
  syncTrivaraTotalOrders,
} from "@/lib/data/trivara-logistics"
import type { TrivaraSyncActionResult } from "@/lib/data/trivara-logistics"

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

function useSyncToast() {
  const toast = useOptionalToast()

  return (result: TrivaraSyncActionResult) => {
    toast?.showToast(result.message, result.success ? "success" : "error")
  }
}

export function LogisticsSyncActions() {
  const [isLocationsPending, startLocationsTransition] = useTransition()
  const [isServicesPending, startServicesTransition] = useTransition()
  const [isTotalOrdersPending, startTotalOrdersTransition] = useTransition()
  const [startDate, setStartDate] = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    return `${today.slice(0, 8)}01`
  })
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const showSyncToast = useSyncToast()

  const handlePickupLocationsSync = () => {
    startLocationsTransition(async () => {
      try {
        const result = await syncTrivaraPickupLocations()
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
      <AdminCard title="Pickup Locations">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Sync pickup location codes from Trivara.
          </p>
          <SyncButton
            isPending={isLocationsPending}
            onClick={handlePickupLocationsSync}
          >
            <MapPinIcon className="h-4 w-4" />
            Sync Locations
          </SyncButton>
        </div>
      </AdminCard>

      <AdminCard title="Services">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Sync service options available for this CRN.
          </p>
          <SyncButton isPending={isServicesPending} onClick={handleServicesSync}>
            <TruckIcon className="h-4 w-4" />
            Sync Services
          </SyncButton>
        </div>
      </AdminCard>

      <AdminCard title="Total Orders">
        <div className="space-y-3">
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
          <SyncButton
            isPending={isTotalOrdersPending}
            onClick={handleTotalOrdersSync}
          >
            <ArrowPathIcon className="h-4 w-4" />
            Sync Total Orders
          </SyncButton>
        </div>
      </AdminCard>
    </div>
  )
}
