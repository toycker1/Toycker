import { getPartialPaymentDisplayData } from "@/lib/util/order-pricing"

export type PaymentStatusTone = "success" | "warning" | "error" | "info" | "neutral"

type PaymentStatusInput = {
  paymentStatus?: string | null
  paymentMethod?: string | null
  orderStatus?: string | null
  metadata?: unknown
}

export type PaymentStatusDisplay = {
  label: string
  tone: PaymentStatusTone
  normalizedStatus: string
  isPartialPayment: boolean
  isCashOnDelivery: boolean
}

export const isPartialPaymentMethod = (paymentMethod?: string | null): boolean =>
  (paymentMethod || "").toLowerCase().includes("partial")

export const isCashOnDeliveryPaymentMethod = (
  paymentMethod?: string | null
): boolean => {
  const value = (paymentMethod || "").toLowerCase()
  return (
    value.includes("cod") ||
    value.includes("cash") ||
    value.includes("pp_system_default")
  )
}

export const getPaymentMethodDisplay = (
  paymentMethod?: string | null
): string => {
  const value = (paymentMethod || "").toLowerCase()

  if (isPartialPaymentMethod(value)) {
    return "Easebuzz Partial Payment"
  }

  if (value.includes("easebuzz")) {
    return "Easebuzz"
  }

  if (value.includes("payu")) {
    return "PayU"
  }

  if (isCashOnDeliveryPaymentMethod(value)) {
    return "Cash on Delivery"
  }

  if (!paymentMethod) {
    return "Manual"
  }

  return paymentMethod
    .replace(/^pp_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export const getPaymentStatusDisplay = ({
  paymentStatus,
  paymentMethod,
  orderStatus,
  metadata,
}: PaymentStatusInput): PaymentStatusDisplay => {
  const rawStatus = (paymentStatus || "").toLowerCase()
  const orderIsCancelled = orderStatus === "cancelled" || orderStatus === "failed"
  const normalizedStatus =
    orderIsCancelled &&
    (rawStatus === "" || rawStatus === "pending" || rawStatus === "awaiting")
      ? "cancelled"
      : rawStatus || (orderIsCancelled ? "cancelled" : "pending")
  const isPartialPayment = isPartialPaymentMethod(paymentMethod)
  const isCashOnDelivery = isCashOnDeliveryPaymentMethod(paymentMethod)
  const partialPaymentData = isPartialPayment
    ? getPartialPaymentDisplayData(metadata)
    : null

  if (isCashOnDelivery) {
    if (normalizedStatus === "paid" || normalizedStatus === "captured") {
      return {
        label: "Paid",
        tone: "success",
        normalizedStatus,
        isPartialPayment,
        isCashOnDelivery,
      }
    }

    if (normalizedStatus === "cancelled" || normalizedStatus === "failed") {
      return {
        label: "COD Cancelled",
        tone: "error",
        normalizedStatus,
        isPartialPayment,
        isCashOnDelivery,
      }
    }

    if (normalizedStatus === "refunded") {
      return {
        label: "COD Refunded",
        tone: "neutral",
        normalizedStatus,
        isPartialPayment,
        isCashOnDelivery,
      }
    }

    return {
      label: "COD Pending",
      tone: "warning",
      normalizedStatus,
      isPartialPayment,
      isCashOnDelivery,
    }
  }

  if (isPartialPayment) {
    if (normalizedStatus === "paid" || normalizedStatus === "captured") {
      return {
        label: "Paid",
        tone: "success",
        normalizedStatus,
        isPartialPayment,
        isCashOnDelivery,
      }
    }

    if (normalizedStatus === "partially_paid") {
      return {
        label:
          partialPaymentData?.balancePaymentStatus === "paid"
            ? "Partial Payment Paid"
            : "Partial Paid - Balance Due",
        tone:
          partialPaymentData?.balancePaymentStatus === "paid"
            ? "success"
            : "info",
        normalizedStatus,
        isPartialPayment,
        isCashOnDelivery,
      }
    }

    if (normalizedStatus === "cancelled" || normalizedStatus === "failed") {
      return {
        label: "Partial Payment Incomplete",
        tone: "error",
        normalizedStatus,
        isPartialPayment,
        isCashOnDelivery,
      }
    }

    if (normalizedStatus === "refunded") {
      return {
        label: "Partial Payment Refunded",
        tone: "neutral",
        normalizedStatus,
        isPartialPayment,
        isCashOnDelivery,
      }
    }

    return {
      label: "Partial Payment Pending",
      tone: "warning",
      normalizedStatus,
      isPartialPayment,
      isCashOnDelivery,
    }
  }

  if (normalizedStatus === "paid" || normalizedStatus === "captured") {
    return {
      label: "Paid",
      tone: "success",
      normalizedStatus,
      isPartialPayment,
      isCashOnDelivery,
    }
  }

  if (normalizedStatus === "cancelled" || normalizedStatus === "failed") {
    return {
      label:
        normalizedStatus === "failed"
          ? "Incomplete Transaction"
          : "Payment Cancelled",
      tone: "error",
      normalizedStatus,
      isPartialPayment,
      isCashOnDelivery,
    }
  }

  if (normalizedStatus === "refunded") {
    return {
      label: "Refunded",
      tone: "neutral",
      normalizedStatus,
      isPartialPayment,
      isCashOnDelivery,
    }
  }

  return {
    label: "Pending",
    tone: "warning",
    normalizedStatus,
    isPartialPayment,
    isCashOnDelivery,
  }
}
