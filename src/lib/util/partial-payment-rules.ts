import type { PartialPaymentRule } from "@/lib/supabase/types"

type NumericDatabaseValue = number | string

export type PartialPaymentRuleInput = Pick<
  PartialPaymentRule,
  "id" | "is_active" | "sort_order"
> & {
  min_order_amount: NumericDatabaseValue
  max_order_amount: NumericDatabaseValue | null
  advance_percentage: NumericDatabaseValue
}

export type ResolvedPartialPaymentRule = {
  percentage: number
  rule: PartialPaymentRuleInput | null
}

export const normalizePartialPaymentPercentage = (
  value: number | null | undefined,
  fallback = 20
): number => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0 && value < 100) {
    return value
  }

  return fallback
}

const toFiniteNumber = (value: NumericDatabaseValue | null | undefined): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const toCurrencyNumber = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100

export const resolvePartialPaymentRule = ({
  finalOrderAmount,
  rules,
  fallbackPercentage,
}: {
  finalOrderAmount: number
  rules?: PartialPaymentRuleInput[] | null
  fallbackPercentage?: number | null
}): ResolvedPartialPaymentRule => {
  const fallback = normalizePartialPaymentPercentage(fallbackPercentage)

  if (!Number.isFinite(finalOrderAmount) || finalOrderAmount < 0) {
    return { percentage: fallback, rule: null }
  }

  const normalizedOrderAmount = toCurrencyNumber(finalOrderAmount)
  const orderedRules = (rules ?? [])
    .filter((rule) => rule.is_active)
    .sort((left, right) => {
      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order
      }

      return (toFiniteNumber(left.min_order_amount) ?? 0) -
        (toFiniteNumber(right.min_order_amount) ?? 0)
    })

  const matchedRule = orderedRules.find((rule) => {
    const startsAt = toFiniteNumber(rule.min_order_amount)
    const endsAt =
      rule.max_order_amount === null || rule.max_order_amount === undefined
        ? null
        : toFiniteNumber(rule.max_order_amount)

    if (startsAt === null || normalizedOrderAmount < toCurrencyNumber(startsAt)) {
      return false
    }

    return endsAt === null || normalizedOrderAmount <= toCurrencyNumber(endsAt)
  })

  if (!matchedRule) {
    return { percentage: fallback, rule: null }
  }

  return {
    percentage: normalizePartialPaymentPercentage(
      toFiniteNumber(matchedRule.advance_percentage),
      fallback
    ),
    rule: matchedRule,
  }
}

export const validatePartialPaymentRules = (
  rules: PartialPaymentRuleInput[]
): string | null => {
  const activeRules = rules
    .filter((rule) => rule.is_active)
    .sort(
      (left, right) =>
        (toFiniteNumber(left.min_order_amount) ?? 0) -
        (toFiniteNumber(right.min_order_amount) ?? 0)
    )

  for (const rule of rules) {
    const minOrderAmount = toFiniteNumber(rule.min_order_amount)
    const maxOrderAmount = toFiniteNumber(rule.max_order_amount)
    const advancePercentage = toFiniteNumber(rule.advance_percentage)

    if (minOrderAmount === null || minOrderAmount < 0) {
      return "Minimum order amount must be zero or greater."
    }

    if (
      rule.max_order_amount !== null &&
      (maxOrderAmount === null || maxOrderAmount <= minOrderAmount)
    ) {
      return "Maximum order amount must be greater than minimum order amount."
    }

    if (
      advancePercentage === null ||
      advancePercentage <= 0 ||
      advancePercentage >= 100
    ) {
      return "Advance payment percentage must be greater than 0 and less than 100."
    }
  }

  for (let index = 1; index < activeRules.length; index += 1) {
    const previous = activeRules[index - 1]
    const current = activeRules[index]

    if (!previous || !current) {
      continue
    }

    const previousMax = previous.max_order_amount
    const previousMaxAmount = toFiniteNumber(previousMax)
    const currentMinAmount = toFiniteNumber(current.min_order_amount)

    if (
      previousMax === null ||
      previousMaxAmount === null ||
      currentMinAmount === null ||
      currentMinAmount <= previousMaxAmount
    ) {
      return "Active partial payment ranges cannot overlap."
    }
  }

  return null
}
