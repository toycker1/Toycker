import { describe, expect, it } from "vitest"

import {
  getPaymentMethodDisplay,
  getPaymentStatusDisplay,
} from "@/lib/util/payment-status"

describe("payment status display", () => {
  it("labels pending partial payments clearly", () => {
    const display = getPaymentStatusDisplay({
      paymentStatus: "pending",
      paymentMethod: "pp_easebuzz_partial_payment",
      orderStatus: "pending",
    })

    expect(display.label).toBe("Partial Payment Pending")
    expect(display.tone).toBe("warning")
    expect(display.isPartialPayment).toBe(true)
  })

  it("labels successful partial advance payments with balance due", () => {
    const display = getPaymentStatusDisplay({
      paymentStatus: "partially_paid",
      paymentMethod: "pp_easebuzz_partial_payment",
      orderStatus: "order_placed",
      metadata: {
        payment_type: "partial",
        advance_amount: 221.55,
        balance_amount: 870,
        balance_payment_status: "pending",
      },
    })

    expect(display.label).toBe("Partial Paid - Balance Due")
    expect(display.tone).toBe("info")
  })

  it("labels incomplete partial payments separately from full online failures", () => {
    const display = getPaymentStatusDisplay({
      paymentStatus: "failed",
      paymentMethod: "pp_easebuzz_partial_payment",
      orderStatus: "failed",
    })

    expect(display.label).toBe("Partial Payment Incomplete")
    expect(display.tone).toBe("error")
  })

  it("labels fully settled partial payments after balance collection", () => {
    const display = getPaymentStatusDisplay({
      paymentStatus: "paid",
      paymentMethod: "pp_easebuzz_partial_payment",
      orderStatus: "delivered",
      metadata: {
        payment_type: "partial",
        advance_amount: 221.55,
        balance_amount: 870,
        balance_payment_status: "paid",
      },
    })

    expect(display.label).toBe("Paid")
    expect(display.tone).toBe("success")
  })

  it("formats partial payment method names for admin and logistics screens", () => {
    expect(getPaymentMethodDisplay("pp_easebuzz_partial_payment")).toBe(
      "Easebuzz Partial Payment"
    )
  })
})
