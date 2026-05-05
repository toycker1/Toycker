import { beforeEach, describe, expect, it, vi } from "vitest"

import { createClient } from "@/lib/supabase/server"
import { getAuthUser } from "@lib/data/auth"
import { getCartId } from "@lib/data/cookies"
import {
  retrieveLayoutCartSummary,
  retrieveLayoutCustomer,
} from "@lib/data/layout-state"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@lib/data/auth", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("@lib/data/cookies", () => ({
  getCartId: vi.fn(),
}))

const createMaybeSingleQuery = (data: unknown) => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)

  return query
}

describe("layout state data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("skips cart database lookup when there is no cart cookie", async () => {
    vi.mocked(getCartId).mockResolvedValue(undefined)

    const cart = await retrieveLayoutCartSummary()

    expect(cart).toBeNull()
    expect(getAuthUser).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it("returns a lightweight cart summary when a cart cookie exists", async () => {
    vi.mocked(getCartId).mockResolvedValue("cart-1")
    vi.mocked(getAuthUser).mockResolvedValue(null)

    const cartQuery = createMaybeSingleQuery({
      id: "cart-1",
      user_id: null,
      region_id: "reg-in",
      currency_code: "inr",
      updated_at: "2026-05-04T08:00:00.000Z",
      items: [{ quantity: 2 }, { quantity: 3 }],
    })
    const from = vi.fn().mockReturnValue(cartQuery)

    vi.mocked(createClient).mockResolvedValue({
      from,
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const cart = await retrieveLayoutCartSummary()

    expect(from).toHaveBeenCalledWith("carts")
    expect(cartQuery.select).toHaveBeenCalledTimes(1)
    const selectShape = String(cartQuery.select.mock.calls[0]?.[0])
    expect(selectShape).toContain("items:cart_items(quantity)")
    expect(selectShape).not.toContain("product:products")
    expect(selectShape).not.toContain("variant:product_variants")
    expect(selectShape).not.toContain("promotion")
    expect(cart).toEqual({
      id: "cart-1",
      user_id: null,
      region_id: "reg-in",
      currency_code: "inr",
      updated_at: "2026-05-04T08:00:00.000Z",
      item_count: 5,
    })
  })

  it("skips customer profile lookup for guests", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)

    const customer = await retrieveLayoutCustomer()

    expect(customer).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it("returns only customer fields needed by layout for signed-in users", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "user-1",
      user_metadata: {
        first_name: "Kartavya",
        is_club_member: false,
      },
    } as unknown as Awaited<ReturnType<typeof getAuthUser>>)

    const profileQuery = createMaybeSingleQuery({
      first_name: "Senior",
      is_club_member: true,
    })
    const from = vi.fn().mockReturnValue(profileQuery)

    vi.mocked(createClient).mockResolvedValue({
      from,
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const customer = await retrieveLayoutCustomer()

    expect(from).toHaveBeenCalledWith("profiles")
    expect(profileQuery.select).toHaveBeenCalledWith(
      "first_name, is_club_member"
    )
    expect(customer).toEqual({
      id: "user-1",
      first_name: "Senior",
      is_club_member: true,
    })
  })
})
