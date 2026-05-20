import { PayUCallbackPayload } from "@/lib/payu"
import { EasebuzzCallbackPayload } from "@/lib/easebuzz"

type UnknownRecord = Record<string, unknown>

export interface OrderPricingMetadata {
  cart_id?: string
  rewards_used?: number
  rewards_discount?: number
  promo_discount?: number
  promo_code?: string | null
  club_savings?: number
  club_savings_amount?: number
  club_discount_amount?: number
  club_discount_percentage?: number
  is_club_member?: boolean
  newly_activated_club_member?: boolean
  payment_discount_amount?: number
  payment_discount_percentage?: number
  payment_method?: string
  payu_payload?: Partial<PayUCallbackPayload>
  easebuzz_payload?: Partial<EasebuzzCallbackPayload>
  payment_type?: "full" | "partial"
  advance_percentage?: number
  advance_amount?: number
  balance_amount?: number
  full_order_amount?: number
  balance_payment_status?: "pending" | "paid"
  balance_paid_at?: string
  balance_payment_method?: string
  club_savings_credited?: boolean
  club_savings_deducted?: boolean
  deducted_amount?: number
  deduction_date?: string
}

type PaymentSessionLike = {
  provider_id?: string
  status?: string
  data?: unknown
}

export type PartialPaymentSessionData = {
  payment_type: "partial"
  advance_percentage: number
  advance_amount: number
  balance_amount: number
  full_order_amount: number
  txnid?: string
  expires_at?: string
}

type OrderLinePricingLike = {
  total?: unknown
  original_total?: unknown
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim())
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

export const getOrderPricingMetadata = (
  value: unknown
): OrderPricingMetadata => {
  if (!isRecord(value)) {
    return {}
  }

  return value as OrderPricingMetadata
}

export const getClubSavingsFromItems = (value: unknown): number | null => {
  if (!Array.isArray(value)) {
    return null
  }

  let totalSavings = 0

  for (const item of value) {
    if (!isRecord(item)) {
      continue
    }

    const pricingItem = item as OrderLinePricingLike
    const originalTotal = toFiniteNumber(pricingItem.original_total)
    const currentTotal = toFiniteNumber(pricingItem.total)

    if (
      originalTotal !== null &&
      currentTotal !== null &&
      originalTotal > currentTotal
    ) {
      totalSavings += originalTotal - currentTotal
    }
  }

  return totalSavings > 0 ? totalSavings : null
}

export const getAppliedClubSavings = ({
  metadata,
  items,
  cartClubSavings,
}: {
  metadata: unknown
  items?: unknown
  cartClubSavings?: unknown
}): number => {
  const orderMetadata = getOrderPricingMetadata(metadata)
  const metadataSavings =
    toFiniteNumber(orderMetadata.club_savings) ??
    toFiniteNumber(orderMetadata.club_savings_amount) ??
    toFiniteNumber(orderMetadata.club_discount_amount)

  if (metadataSavings !== null && metadataSavings > 0) {
    return metadataSavings
  }

  const itemSavings = getClubSavingsFromItems(items)
  if (itemSavings !== null && itemSavings > 0) {
    return itemSavings
  }

  const cartSavings = toFiniteNumber(cartClubSavings)
  if (cartSavings !== null && cartSavings > 0) {
    return cartSavings
  }

  return 0
}

export const getPendingPaymentProviderId = (value: unknown): string | null => {
  if (!isRecord(value)) {
    return null
  }

  const paymentSessions = value.payment_sessions
  if (!Array.isArray(paymentSessions)) {
    return null
  }

  for (const session of paymentSessions) {
    if (!isRecord(session)) {
      continue
    }

    const typedSession = session as PaymentSessionLike
    if (
      typedSession.status === "pending" &&
      typeof typedSession.provider_id === "string" &&
      typedSession.provider_id.length > 0
    ) {
      return typedSession.provider_id
    }
  }

  return null
}

export const getPaymentSessionDataForProvider = (
  value: unknown,
  providerId: string
): Record<string, unknown> | null => {
  if (!isRecord(value)) {
    return null
  }

  const paymentSessions = value.payment_sessions
  if (!Array.isArray(paymentSessions)) {
    return null
  }

  for (const session of paymentSessions) {
    if (!isRecord(session)) {
      continue
    }

    const typedSession = session as PaymentSessionLike
    if (typedSession.provider_id !== providerId || !isRecord(typedSession.data)) {
      continue
    }

    return typedSession.data
  }

  return null
}

export const getPartialPaymentSessionData = (
  value: unknown,
  providerId: string
): PartialPaymentSessionData | null => {
  const data = getPaymentSessionDataForProvider(value, providerId)
  if (!data || data.payment_type !== "partial") {
    return null
  }

  const advancePercentage = toFiniteNumber(data.advance_percentage)
  const advanceAmount = toFiniteNumber(data.advance_amount)
  const balanceAmount = toFiniteNumber(data.balance_amount)
  const fullOrderAmount = toFiniteNumber(data.full_order_amount)

  if (
    advancePercentage === null ||
    advanceAmount === null ||
    balanceAmount === null ||
    fullOrderAmount === null
  ) {
    return null
  }

  return {
    payment_type: "partial",
    advance_percentage: advancePercentage,
    advance_amount: advanceAmount,
    balance_amount: balanceAmount,
    full_order_amount: fullOrderAmount,
    txnid: typeof data.txnid === "string" ? data.txnid : undefined,
    expires_at: typeof data.expires_at === "string" ? data.expires_at : undefined,
  }
}

const parseCurrencyAmount = (
  value: number | string | null | undefined
): number | null => {
  return toFiniteNumber(value)
}

export const normalizeCurrencyAmount = (
  value: number | string | null | undefined
): string | null => {
  const parsed = parseCurrencyAmount(value)
  if (parsed === null) {
    return null
  }

  return parsed.toFixed(2)
}

export const currencyAmountsMatch = (
  left: number | string | null | undefined,
  right: number | string | null | undefined
): boolean => {
  const normalizedLeft = normalizeCurrencyAmount(left)
  const normalizedRight = normalizeCurrencyAmount(right)

  return normalizedLeft !== null && normalizedLeft === normalizedRight
}
