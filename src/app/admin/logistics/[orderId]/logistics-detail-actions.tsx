"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import type { ComponentType } from "react"
import {
  DocumentTextIcon,
  TruckIcon,
} from "@heroicons/react/24/outline"
import { cn } from "@lib/util/cn"
import { useOptionalToast } from "@modules/common/context/toast-context"
import {
  printTrivaraSlip,
  trackTrivaraOrder,
} from "@/lib/data/trivara-logistics"

type LogisticsDetailActionsProps = {
  orderId: string
}

type ActionButtonProps = {
  label: string
  loadingLabel: string
  pending: boolean
  tone: "primary" | "secondary"
  icon: ComponentType<{ className?: string }>
  onClick: () => void
}

function ActionButton({
  label,
  loadingLabel,
  pending,
  tone,
  icon: Icon,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        "inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        tone === "primary"
          ? "bg-gray-900 text-white hover:bg-black"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      )}
    >
      {pending ? (
        <span
          className={cn(
            "h-4 w-4 animate-spin rounded-full border-2 border-t-transparent",
            tone === "primary" ? "border-white" : "border-gray-500"
          )}
        />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {pending ? loadingLabel : label}
    </button>
  )
}

export function LogisticsDetailActions({ orderId }: LogisticsDetailActionsProps) {
  const router = useRouter()
  const toast = useOptionalToast()
  const [isTrackingPending, startTrackingTransition] = useTransition()
  const [isSlipPending, startSlipTransition] = useTransition()

  const showResultToast = (result: { success: boolean; message: string }) => {
    toast?.showToast(result.message, result.success ? "success" : "error")
  }

  const handleTrack = () => {
    startTrackingTransition(async () => {
      try {
        const result = await trackTrivaraOrder(orderId)
        showResultToast(result)
        router.refresh()
      } catch {
        toast?.showToast("Tracking sync failed. Please try again.", "error")
      }
    })
  }

  const handlePrintSlip = () => {
    startSlipTransition(async () => {
      try {
        const result = await printTrivaraSlip(orderId)
        showResultToast(result)
        router.refresh()
      } catch {
        toast?.showToast("Print slip sync failed. Please try again.", "error")
      }
    })
  }

  return (
    <>
      <ActionButton
        label="Track"
        loadingLabel="Tracking..."
        pending={isTrackingPending}
        tone="primary"
        icon={TruckIcon}
        onClick={handleTrack}
      />
      <ActionButton
        label="Print Slip"
        loadingLabel="Syncing..."
        pending={isSlipPending}
        tone="secondary"
        icon={DocumentTextIcon}
        onClick={handlePrintSlip}
      />
    </>
  )
}
