import { describe, expect, it } from "vitest"

import {
  resolvePartialPaymentRule,
  validatePartialPaymentRules,
  type PartialPaymentRuleInput,
} from "@/lib/util/partial-payment-rules"

const rules: PartialPaymentRuleInput[] = [
  {
    id: "rule_1",
    min_order_amount: 0,
    max_order_amount: 999.99,
    advance_percentage: 30,
    is_active: true,
    sort_order: 0,
  },
  {
    id: "rule_2",
    min_order_amount: 1000,
    max_order_amount: 2999.99,
    advance_percentage: 20,
    is_active: true,
    sort_order: 1,
  },
  {
    id: "rule_3",
    min_order_amount: 3000,
    max_order_amount: null,
    advance_percentage: 15,
    is_active: true,
    sort_order: 2,
  },
]

describe("partial payment rules", () => {
  it("resolves percentage from the matching order total range", () => {
    expect(
      resolvePartialPaymentRule({
        finalOrderAmount: 899,
        rules,
        fallbackPercentage: 20,
      }).percentage
    ).toBe(30)

    expect(
      resolvePartialPaymentRule({
        finalOrderAmount: 1709.05,
        rules,
        fallbackPercentage: 20,
      }).percentage
    ).toBe(20)

    expect(
      resolvePartialPaymentRule({
        finalOrderAmount: 3500,
        rules,
        fallbackPercentage: 20,
      }).percentage
    ).toBe(15)
  })

  it("matches inclusive range boundaries", () => {
    expect(
      resolvePartialPaymentRule({
        finalOrderAmount: 999.99,
        rules,
        fallbackPercentage: 20,
      }).rule?.id
    ).toBe("rule_1")

    expect(
      resolvePartialPaymentRule({
        finalOrderAmount: 1000,
        rules,
        fallbackPercentage: 20,
      }).rule?.id
    ).toBe("rule_2")
  })

  it("matches Supabase numeric string values", () => {
    expect(
      resolvePartialPaymentRule({
        finalOrderAmount: 499,
        rules: [
          {
            id: "rule_string_values",
            min_order_amount: "0",
            max_order_amount: "499",
            advance_percentage: "10",
            is_active: true,
            sort_order: 0,
          },
        ],
        fallbackPercentage: 20,
      }).percentage
    ).toBe(10)
  })

  it("rounds order totals to currency precision before matching", () => {
    expect(
      resolvePartialPaymentRule({
        finalOrderAmount: 499.0000000001,
        rules: [
          {
            id: "rule_currency_boundary",
            min_order_amount: 0,
            max_order_amount: 499,
            advance_percentage: 10,
            is_active: true,
            sort_order: 0,
          },
        ],
        fallbackPercentage: 20,
      }).percentage
    ).toBe(10)
  })

  it("uses the amount passed for rule matching, not the payment split amount", () => {
    expect(
      resolvePartialPaymentRule({
        finalOrderAmount: 399,
        rules: [
          {
            id: "rule_399",
            min_order_amount: 0,
            max_order_amount: 399,
            advance_percentage: 10,
            is_active: true,
            sort_order: 0,
          },
        ],
        fallbackPercentage: 20,
      }).percentage
    ).toBe(10)
  })

  it("falls back when no active rule matches", () => {
    expect(
      resolvePartialPaymentRule({
        finalOrderAmount: 1500,
        rules: [{ ...rules[1], is_active: false }],
        fallbackPercentage: 25,
      }).percentage
    ).toBe(25)
  })

  it("validates overlapping active ranges", () => {
    expect(
      validatePartialPaymentRules([
        { ...rules[0], max_order_amount: 1200 },
        { ...rules[1], min_order_amount: 1000 },
      ])
    ).toBe("Active partial payment ranges cannot overlap.")
  })

  it("allows inactive overlapping ranges", () => {
    expect(
      validatePartialPaymentRules([
        { ...rules[0], max_order_amount: 1200 },
        { ...rules[1], min_order_amount: 1000, is_active: false },
      ])
    ).toBeNull()
  })
})
