import { Radio as RadioGroupOption } from "@headlessui/react"
import { Text } from "@modules/common/components/text"
import { cn } from "@lib/util/cn"
import React, { type JSX } from "react"

import Radio from "@modules/common/components/radio"

type PaymentContainerProps = {
  paymentProviderId: string
  selectedPaymentOptionId: string | null
  disabled?: boolean
  badgeLabel?: string | null
  paymentInfoMap: Record<
    string,
    { title: string; icon: JSX.Element; description?: string }
  >
  children?: React.ReactNode
}

const PaymentContainer: React.FC<PaymentContainerProps> = ({
  paymentProviderId,
  selectedPaymentOptionId,
  paymentInfoMap,
  disabled = false,
  badgeLabel = null,
  children,
}) => {
  const isSelected = selectedPaymentOptionId === paymentProviderId

  return (
    <RadioGroupOption
      key={paymentProviderId}
      value={paymentProviderId}
      disabled={disabled}
      aria-disabled={disabled}
      data-testid={`payment-option-${paymentProviderId}`}
      className={cn(
        "group flex flex-col border rounded-xl overflow-hidden transition-all duration-200 mb-4",
        {
          "cursor-not-allowed border-gray-200 bg-gray-50/80 opacity-70": disabled,
          "cursor-pointer border-blue-600 bg-blue-50/30 shadow-sm": isSelected && !disabled,
          "cursor-pointer border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm": !isSelected && !disabled,
        }
      )}
    >
      {/* Payment Method Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-3 sm:gap-4 flex-1">
          <Radio checked={isSelected} disabled={disabled} />
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <Text className="text-sm sm:text-base font-semibold text-gray-900">
                {paymentInfoMap[paymentProviderId]?.title || paymentProviderId}
              </Text>
              {badgeLabel && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  {badgeLabel}
                </span>
              )}
            </div>
            {paymentInfoMap[paymentProviderId]?.description && (
              <Text className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-snug">
                {paymentInfoMap[paymentProviderId]?.description}
              </Text>
            )}
          </div>
        </div>
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg transition-colors",
            {
              "bg-gray-100": disabled,
              "bg-gray-50 group-hover:bg-gray-100": !disabled,
            }
          )}
        >
          <span className={cn("text-gray-600", { "text-gray-400": disabled })}>
            {paymentInfoMap[paymentProviderId]?.icon}
          </span>
        </div>
      </div>

      {/* Additional Content (Card Details) */}
      {children && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-0">
          <div className="border-t border-gray-200 pt-3 sm:pt-4 mt-1">
            {children}
          </div>
        </div>
      )}
    </RadioGroupOption>
  )
}

export default PaymentContainer
