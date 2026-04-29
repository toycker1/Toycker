import { describe, expect, it, vi } from "vitest"

import {
  buildTrivaraOrderBookingPayload,
  sendTrivaraCancelOrder,
  sendTrivaraOrderTracking,
  sendTrivaraPickupLocations,
  sendTrivaraPrintSlip,
  sendTrivaraServices,
  sendTrivaraTotalOrders,
  sendTrivaraOrderBooking,
  TrivaraConfig,
} from "@/lib/integrations/trivara"
import { Order } from "@/lib/supabase/types"

const config: Pick<
  TrivaraConfig,
  | "crnNo"
  | "pickupLocationCode"
  | "service"
  | "shipmentType"
  | "servicePartner"
  | "defaultWeightGrams"
> = {
  crnNo: "857252",
  pickupLocationCode: "857252_2",
  service: "SURFACE",
  shipmentType: "PARCEL",
  servicePartner: "",
  defaultWeightGrams: "1500",
}

const buildOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "order-1",
  user_id: "user-1",
  display_id: 1223,
  customer_email: "buyer@example.com",
  email: "buyer@example.com",
  promo_code: null,
  total_amount: 2500,
  currency_code: "inr",
  status: "order_placed",
  fulfillment_status: "not_shipped",
  payment_status: "pending",
  payu_txn_id: null,
  gateway_txn_id: null,
  shipping_address: {
    first_name: "Customer",
    last_name: "Name",
    company: null,
    address_1: "Shop No 1",
    address_2: "Prabhunagar, Hirabag Circle",
    city: "Surat",
    province: "Gujarat",
    country_code: "in",
    postal_code: "395006",
    phone: "+91 98989 89898",
  },
  billing_address: null,
  shipping_method: null,
  shipping_methods: [],
  shipping_partner_id: null,
  shipping_partner: null,
  tracking_number: null,
  payment_method: "cash_on_delivery",
  payment_collection: null,
  metadata: null,
  created_at: "2026-04-28T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z",
  items: [
    {
      id: "item-1",
      cart_id: "cart-1",
      product_id: "prod-1",
      variant_id: "var-1",
      quantity: 1,
      created_at: "2026-04-28T00:00:00.000Z",
      updated_at: "2026-04-28T00:00:00.000Z",
      title: "Toy Car",
      product_title: "Toy Car",
      unit_price: 2500,
      total: 2500,
    },
  ],
  total: 2500,
  subtotal: 2500,
  tax_total: 0,
  shipping_total: 0,
  discount_total: 0,
  gift_card_total: 0,
  payment_collections: [],
  ...overrides,
})

describe("Trivara order booking integration", () => {
  it("builds COD payload from Toycker order data", () => {
    const payload = buildTrivaraOrderBookingPayload(buildOrder(), config)

    expect(payload).toMatchObject({
      crn_no: "857252",
      order_number: "ORD1223",
      consignee_name: "Customer Name",
      city: "Surat",
      state: "Gujarat",
      country: "India",
      address: "Shop No 1, Prabhunagar, Hirabag Circle",
      pincode: "395006",
      mobile: "9898989898",
      weight: "1500",
      payment_mode: "COD",
      package_amount: "2500",
      cod_amount: "2500",
      product_detail: "Toy Car",
      shipment_type: "PARCEL",
      service: "SURFACE",
      pickup_location_code: "857252_2",
    })
  })

  it("builds prepaid payload for online paid orders", () => {
    const payload = buildTrivaraOrderBookingPayload(
      buildOrder({
        payment_method: "easebuzz",
        payment_status: "captured",
      }),
      config
    )

    expect(payload.payment_mode).toBe("PREPAID")
    expect(payload.cod_amount).toBe("")
  })

  it("rejects missing required shipping fields", () => {
    const order = buildOrder({
      shipping_address: {
        ...buildOrder().shipping_address!,
        postal_code: null,
      },
    })

    expect(() => buildTrivaraOrderBookingPayload(order, config)).toThrow(
      "Shipping pincode is required for Trivara booking"
    )
  })

  it("sends multipart form data to Trivara and extracts reference number", async () => {
    let capturedUrl: string | URL | null = null
    let capturedInit: RequestInit | undefined
    const fetcher = vi.fn(async (input: string | URL, init?: RequestInit) => {
      capturedUrl = input
      capturedInit = init

      return new Response(
        JSON.stringify({ reference_number: "857252P0000044" }),
        { status: 200 }
      )
    })

    const payload = buildTrivaraOrderBookingPayload(buildOrder(), config)
    const result = await sendTrivaraOrderBooking(
      payload,
      {
        apiBaseUrl: "https://app.trivaralogistics.in",
        apiKey: "secret-key",
      },
      fetcher
    )

    expect(String(capturedUrl)).toBe(
      "https://app.trivaralogistics.in/api/users/V2/OrderBooking/create_order"
    )
    expect(capturedInit?.method).toBe("POST")
    expect(capturedInit?.headers).toEqual({ Apikey: "secret-key" })
    expect(capturedInit?.body).toBeInstanceOf(FormData)
    expect((capturedInit?.body as FormData).get("order_number")).toBe("ORD1223")
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      referenceNumber: "857252P0000044",
    })
  })
})

describe("Trivara remaining endpoint integrations", () => {
  async function captureRequest(
    request: (
      _fetcher: (
        _input: string | URL,
        _init?: RequestInit
      ) => Promise<Response>
    ) => Promise<unknown>
  ) {
    let capturedUrl: string | URL | null = null
    let capturedInit: RequestInit | undefined
    const fetcher = vi.fn(async (input: string | URL, init?: RequestInit) => {
      capturedUrl = input
      capturedInit = init

      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    await request(fetcher)

    return { capturedUrl, capturedInit }
  }

  it("sends tracking with the api_key header", async () => {
    const { capturedUrl, capturedInit } = await captureRequest((fetcher) =>
      sendTrivaraOrderTracking(
        { crn_no: "857252", reference_number: "857252P0000044" },
        { apiBaseUrl: "https://app.trivaralogistics.in", apiKey: "track-key" },
        fetcher
      )
    )

    expect(String(capturedUrl)).toBe(
      "https://app.trivaralogistics.in/api/users/V2/OrderBooking/track_parcel"
    )
    expect(capturedInit?.headers).toEqual({ api_key: "track-key" })
    expect((capturedInit?.body as FormData).get("reference_number")).toBe(
      "857252P0000044"
    )
  })

  it("sends print slip with the Apikey header", async () => {
    const { capturedUrl, capturedInit } = await captureRequest((fetcher) =>
      sendTrivaraPrintSlip(
        { crn_no: "857252", reference_number: "857252P0000044" },
        {
          apiBaseUrl: "https://production.trivaralogistics.in",
          apiKey: "print-key",
        },
        fetcher
      )
    )

    expect(String(capturedUrl)).toBe(
      "https://production.trivaralogistics.in/api/users/V2/OrderBooking/print_slip"
    )
    expect(capturedInit?.headers).toEqual({ Apikey: "print-key" })
  })

  it("sends total orders date range", async () => {
    const { capturedUrl, capturedInit } = await captureRequest((fetcher) =>
      sendTrivaraTotalOrders(
        {
          crn_no: "857252",
          start_date: "2026-04-01",
          end_date: "2026-04-28",
        },
        { apiBaseUrl: "https://app.trivaralogistics.in", apiKey: "order-key" },
        fetcher
      )
    )

    expect(String(capturedUrl)).toBe(
      "https://app.trivaralogistics.in/api/users/V2/OrderBooking/get_total_orders"
    )
    expect(capturedInit?.headers).toEqual({ Apikey: "order-key" })
    expect((capturedInit?.body as FormData).get("start_date")).toBe(
      "2026-04-01"
    )
  })

  it("sends cancel order with the reference number", async () => {
    const { capturedUrl, capturedInit } = await captureRequest((fetcher) =>
      sendTrivaraCancelOrder(
        { crn_no: "857252", reference_number: "857252P0000044" },
        { apiBaseUrl: "https://app.trivaralogistics.in", apiKey: "cancel-key" },
        fetcher
      )
    )

    expect(String(capturedUrl)).toBe(
      "https://app.trivaralogistics.in/api/users/V2/OrderBooking/cancel_multiple_orders"
    )
    expect(capturedInit?.headers).toEqual({ Apikey: "cancel-key" })
  })

  it("sends pickup locations and services with the api_key header", async () => {
    const pickup = await captureRequest((fetcher) =>
      sendTrivaraPickupLocations(
        { crn_no: "857252" },
        { apiBaseUrl: "https://app.trivaralogistics.in", apiKey: "master-key" },
        fetcher
      )
    )
    const services = await captureRequest((fetcher) =>
      sendTrivaraServices(
        { crn_no: "857252" },
        { apiBaseUrl: "https://app.trivaralogistics.in", apiKey: "master-key" },
        fetcher
      )
    )

    expect(String(pickup.capturedUrl)).toBe(
      "https://app.trivaralogistics.in/api/users/V2/OrderBooking/get_pickup_location"
    )
    expect(pickup.capturedInit?.headers).toEqual({ api_key: "master-key" })
    expect(String(services.capturedUrl)).toBe(
      "https://app.trivaralogistics.in/api/users/V2/Activity/get_services"
    )
    expect(services.capturedInit?.headers).toEqual({ api_key: "master-key" })
  })
})
