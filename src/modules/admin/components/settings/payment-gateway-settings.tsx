"use client"

import { useState, useTransition } from "react"
import AdminCard from "@modules/admin/components/admin-card"
import { setActiveOnlineGateway } from "@/lib/data/admin"
import { CheckIcon, CreditCardIcon } from "@heroicons/react/24/outline"
import { useOptionalToast } from "@modules/common/context/toast-context"

type GatewayOption = {
  id: string
  name: string
  is_active: boolean
}

const GATEWAY_DESCRIPTIONS: Record<string, string> = {
  pp_easebuzz_easebuzz: "Cards, UPI, net banking, wallets via Easebuzz.",
  pp_payu_payu: "Cards, UPI, net banking, wallets via PayU.",
}

export default function PaymentGatewaySettings({
  initialGateways,
}: {
  initialGateways: GatewayOption[]
}) {
  const activeGateway = initialGateways.find((g) => g.is_active)
  const [selectedId, setSelectedId] = useState<string>(activeGateway?.id ?? "")
  const [isPending, startTransition] = useTransition()
  const toast = useOptionalToast()

  const handleSave = () => {
    if (!selectedId) return
    startTransition(async () => {
      try {
        const result = await setActiveOnlineGateway(selectedId)
        if (result.success) {
          toast?.showToast("Payment gateway updated successfully", "success")
        } else {
          toast?.showToast(result.error ?? "Failed to update payment gateway", "error")
        }
      } catch {
        toast?.showToast("Failed to update payment gateway", "error")
      }
    })
  }

  return (
    <AdminCard title="Online Payment Gateway">
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <CreditCardIcon className="h-6 w-6 text-indigo-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Active Gateway</p>
            <p className="text-xs text-gray-500">
              Only one online payment gateway is active at a time.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {initialGateways.map((gateway) => {
            const isSelected = selectedId === gateway.id
            return (
              <button
                key={gateway.id}
                type="button"
                onClick={() => setSelectedId(gateway.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div
                  className={`flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-gray-300"
                  }`}
                >
                  {isSelected && (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {gateway.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {GATEWAY_DESCRIPTIONS[gateway.id] ?? "Online payment gateway."}
                  </p>
                </div>
                {gateway.is_active && (
                  <span className="flex-shrink-0 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={isPending || selectedId === (activeGateway?.id ?? "")}
            className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              "Saving..."
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </AdminCard>
  )
}
