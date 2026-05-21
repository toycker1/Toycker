import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildTrivaraOrderBookingPayload,
  extractTrivaraReferenceNumber,
  extractTrivaraTrackingStatus,
  extractTrivaraWaybillNumber,
  getTrivaraApiBaseUrl,
  getTrivaraConfig,
  sendTrivaraCancelOrder,
  sendTrivaraActivePartners,
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
  | "warehouseName"
  | "service"
  | "shipmentType"
  | "servicePartnerId"
  | "defaultWeightGrams"
  | "defaultLengthCm"
  | "defaultWidthCm"
  | "defaultHeightCm"
> = {
  crnNo: "868369",
  warehouseName: "DOMINANT_INFOTECH_101380",
  service: "SURFACE",
  shipmentType: "PARCEL",
  servicePartnerId: 1,
  defaultWeightGrams: 500,
  defaultLengthCm: 20,
  defaultWidthCm: 15,
  defaultHeightCm: 10,
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
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("builds V2 COD payload from Toycker order data", () => {
    const payload = buildTrivaraOrderBookingPayload(buildOrder(), config)

    expect(payload).toMatchObject({
      warehouse_name: "DOMINANT_INFOTECH_101380",
      service_partner_id: 1,
      crn_no: "868369",
      orders: [
        {
          user_reference_id: "toycker_order-1",
          user_order_id: 1223,
          consignee_name: "Customer Name",
          mobile: "9898989898",
          pincode: "395006",
          address: "Shop No 1, Prabhunagar, Hirabag Circle",
          payment_mode: "COD",
          service: "SURFACE",
          shipment_type: "PARCEL",
          length: 20,
          width: 15,
          height: 10,
          weight: 500,
          email: "buyer@example.com",
          total_amount: 2500,
          total_cod_amount: 2500,
          items: [
            {
              product_detail: "Toy Car",
              package_amount: 2500,
              product_sku: "1223-1",
              quantity: 1,
            },
          ],
        },
      ],
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

    expect(payload.orders[0]?.payment_mode).toBe("PREPAID")
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

  it("sends V2 JSON booking data to Trivara and extracts reference number", async () => {
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
        apiBaseUrl: "https://app.trivaralogistics.com",
        apiKey: "secret-key",
      },
      fetcher
    )

    expect(String(capturedUrl)).toBe(
      "https://app.trivaralogistics.com/api/users/V2/OrderBooking/create_order"
    )
    expect(capturedInit?.method).toBe("POST")
    expect(capturedInit?.headers).toEqual({
      Apikey: "secret-key",
      "Content-Type": "application/json",
    })
    expect(JSON.parse(String(capturedInit?.body))).toMatchObject({
      warehouse_name: "DOMINANT_INFOTECH_101380",
      service_partner_id: 1,
      crn_no: "868369",
    })
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      referenceNumber: "857252P0000044",
      errorMessage: null,
    })
  })

  it("extracts reference numbers from Trivara data array responses", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: [
            {
              status: "SUCCESS",
              message: "Order Created",
              waybill: "46322610068051",
              order_id: 6668,
              reference_number: "260000015315",
            },
          ],
          error: "",
          result: "Processed",
        }),
        { status: 200 }
      )
    })

    const payload = buildTrivaraOrderBookingPayload(buildOrder(), config)
    const result = await sendTrivaraOrderBooking(
      payload,
      {
        apiBaseUrl: "https://app.trivaralogistics.com",
        apiKey: "secret-key",
      },
      fetcher
    )

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      referenceNumber: "260000015315",
      errorMessage: null,
    })
  })

  it("keeps Trivara reference and waybill extraction separate", () => {
    const payload = {
      data: [
        {
          status: "SUCCESS",
          message: "Order Created",
          waybill: "46322610068051",
          order_id: 6668,
          reference_number: "260000015315",
        },
      ],
      result: "Processed",
    }

    expect(extractTrivaraReferenceNumber(payload)).toBe("260000015315")
    expect(extractTrivaraWaybillNumber(payload)).toBe("46322610068051")
  })

  it("extracts current Trivara tracking status from nested payloads", () => {
    const payload = {
      status: "success",
      data: [
        {
          status: "SUCCESS",
          waybill: "46322610068051",
          current_status: "Manifested",
        },
      ],
    }

    expect(extractTrivaraTrackingStatus(payload)).toBe("Manifested")
  })

  it("prefers Trivara current_state over generic success status", () => {
    const payload = {
      status: "success",
      order_details: {
        awb: "26000015677",
        current_state: "CANCELLED",
      },
    }

    expect(extractTrivaraTrackingStatus(payload)).toBe("CANCELLED")
  })

  it("rejects invalid Trivara base URLs before sending requests", () => {
    process.env.TRIVARA_API_BASE_URL = "OY6R-not-a-url"

    expect(() => getTrivaraApiBaseUrl()).toThrow(
      "TRIVARA_API_BASE_URL must be a full URL starting with https:// or http://"
    )
  })

  it("requires a service partner ID when live booking is enabled", () => {
    process.env.TRIVARA_BOOKING_ENABLED = "true"
    process.env.TRIVARA_API_BASE_URL = "https://app.trivaralogistics.com"
    process.env.TRIVARA_API_KEY = "secret-key"
    process.env.TRIVARA_CRN_NO = "857252"
    process.env.TRIVARA_WAREHOUSE_NAME = "DOMINANT_INFOTECH_101380"
    process.env.TRIVARA_SERVICE_PARTNER_ID = ""

    expect(() => getTrivaraConfig()).toThrow(
      "Missing required environment variable: TRIVARA_SERVICE_PARTNER_ID"
    )
  })

  it("rejects non-numeric service partner IDs", () => {
    process.env.TRIVARA_BOOKING_ENABLED = "true"
    process.env.TRIVARA_API_BASE_URL = "https://app.trivaralogistics.com"
    process.env.TRIVARA_API_KEY = "secret-key"
    process.env.TRIVARA_CRN_NO = "857252"
    process.env.TRIVARA_WAREHOUSE_NAME = "DOMINANT_INFOTECH_101380"
    process.env.TRIVARA_SERVICE_PARTNER_ID = "DEL"

    expect(() => getTrivaraConfig()).toThrow(
      "TRIVARA_SERVICE_PARTNER_ID must be a positive numeric partner ID"
    )
  })

  it("requires a warehouse name when live booking is enabled", () => {
    process.env.TRIVARA_BOOKING_ENABLED = "true"
    process.env.TRIVARA_API_BASE_URL = "https://app.trivaralogistics.com"
    process.env.TRIVARA_API_KEY = "secret-key"
    process.env.TRIVARA_CRN_NO = "868369"
    process.env.TRIVARA_WAREHOUSE_NAME = ""
    process.env.TRIVARA_SERVICE_PARTNER_ID = "1"

    expect(() => getTrivaraConfig()).toThrow(
      "Missing required environment variable: TRIVARA_WAREHOUSE_NAME"
    )
  })

  it("keeps a successful HTTP response incomplete when no reference number exists", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    })

    const payload = buildTrivaraOrderBookingPayload(
      buildOrder(),
      {
        ...config,
        servicePartnerId: 1,
      }
    )
    const result = await sendTrivaraOrderBooking(
      payload,
      {
        apiBaseUrl: "https://app.trivaralogistics.com",
        apiKey: "secret-key",
      },
      fetcher
    )

    expect(result.ok).toBe(true)
    expect(result.referenceNumber).toBeNull()
    expect(result.errorMessage).toBeNull()
    expect(result.responsePayload).toEqual({ success: true })
  })

  it("treats Trivara business errors as failed bookings", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: [{ status: "ERROR", message: "Invalid Partner" }],
          error: "",
          result: "Processed",
        }),
        { status: 200 }
      )
    })

    const payload = buildTrivaraOrderBookingPayload(buildOrder(), config)
    const result = await sendTrivaraOrderBooking(
      payload,
      {
        apiBaseUrl: "https://app.trivaralogistics.com",
        apiKey: "secret-key",
      },
      fetcher
    )

    expect(result.ok).toBe(false)
    expect(result.referenceNumber).toBeNull()
    expect(result.errorMessage).toBe("Invalid Partner")
  })

  it("includes low-level network cause details when fetch fails", async () => {
    const fetchError = Object.assign(new Error("fetch failed"), {
      cause: {
        code: "ENOTFOUND",
        hostname: "app.trivaralogistics.com",
        syscall: "getaddrinfo",
      },
    })
    const fetcher = vi.fn(async () => {
      throw fetchError
    })
    const payload = buildTrivaraOrderBookingPayload(
      buildOrder(),
      {
        ...config,
        servicePartnerId: 1,
      }
    )

    await expect(
      sendTrivaraOrderBooking(
        payload,
        {
          apiBaseUrl: "https://app.trivaralogistics.com",
          apiKey: "secret-key",
        },
        fetcher
      )
    ).rejects.toThrow(
      "Trivara request failed before receiving a response (ENOTFOUND app.trivaralogistics.com getaddrinfo)"
    )
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

  it("sends tracking with the Apikey header and waybill", async () => {
    const { capturedUrl, capturedInit } = await captureRequest((fetcher) =>
      sendTrivaraOrderTracking(
        { crn_no: "857252", action: "track", waybill: "46322610057562" },
        { apiBaseUrl: "https://app.trivaralogistics.com", apiKey: "track-key" },
        fetcher
      )
    )

    expect(String(capturedUrl)).toBe(
      "https://app.trivaralogistics.com/api/users/V2/OrderBooking/track_parcel"
    )
    expect(capturedInit?.headers).toEqual({ Apikey: "track-key" })
    expect((capturedInit?.body as FormData).get("action")).toBe("track")
    expect((capturedInit?.body as FormData).get("waybill")).toBe(
      "46322610057562"
    )
  })

  it("sends print slip with the Apikey header", async () => {
    const { capturedUrl, capturedInit } = await captureRequest((fetcher) =>
      sendTrivaraPrintSlip(
        {
          crn_no: "857252",
          reference_number: "857252P0000044",
          awb_number: "857252P0000044",
        },
        {
          apiBaseUrl: "https://app.trivaralogistics.com",
          apiKey: "print-key",
        },
        fetcher
      )
    )

    expect(String(capturedUrl)).toBe(
      "https://app.trivaralogistics.com/api/users/V2/OrderBooking/print_slip"
    )
    expect(capturedInit?.headers).toEqual({ Apikey: "print-key" })
    expect((capturedInit?.body as FormData).get("awb_number")).toBe(
      "857252P0000044"
    )
  })

  it("sends total orders date range", async () => {
    const { capturedUrl, capturedInit } = await captureRequest((fetcher) =>
      sendTrivaraTotalOrders(
        {
          crn_no: "857252",
          start_date: "2026-04-01",
          end_date: "2026-04-28",
        },
        { apiBaseUrl: "https://app.trivaralogistics.com", apiKey: "order-key" },
        fetcher
      )
    )

    expect(String(capturedUrl)).toBe(
      "https://app.trivaralogistics.com/api/users/V2/OrderBooking/get_total_orders"
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
        { apiBaseUrl: "https://app.trivaralogistics.com", apiKey: "cancel-key" },
        fetcher
      )
    )

    expect(String(capturedUrl)).toBe(
      "https://app.trivaralogistics.com/api/users/V2/OrderBooking/cancel_order"
    )
    expect(capturedInit?.headers).toEqual({ Apikey: "cancel-key" })
  })

  it("treats cancel order business errors as failed responses", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: [{ status: "ERROR", message: "Cancel Failed" }],
          error: "",
          result: "Processed",
        }),
        { status: 200 }
      )
    })

    const result = await sendTrivaraCancelOrder(
      { crn_no: "857252", reference_number: "857252P0000044" },
      { apiBaseUrl: "https://app.trivaralogistics.com", apiKey: "cancel-key" },
      fetcher
    )

    expect(result.ok).toBe(false)
    expect(result.status).toBe(200)
    expect(result.responsePayload).toMatchObject({
      data: [{ status: "ERROR", message: "Cancel Failed" }],
    })
  })

  it("sends pickup locations, services, and active partners with the Apikey header", async () => {
    const pickup = await captureRequest((fetcher) =>
      sendTrivaraPickupLocations(
        { crn_no: "857252" },
        { apiBaseUrl: "https://app.trivaralogistics.com", apiKey: "master-key" },
        fetcher
      )
    )
    const services = await captureRequest((fetcher) =>
      sendTrivaraServices(
        { crn_no: "857252" },
        { apiBaseUrl: "https://app.trivaralogistics.com", apiKey: "master-key" },
        fetcher
      )
    )
    const partners = await captureRequest((fetcher) =>
      sendTrivaraActivePartners(
        { crn_no: "857252" },
        { apiBaseUrl: "https://app.trivaralogistics.com", apiKey: "master-key" },
        fetcher
      )
    )

    expect(String(pickup.capturedUrl)).toBe(
      "https://app.trivaralogistics.com/api/users/V2/OrderBooking/get_pickup_location"
    )
    expect(pickup.capturedInit?.headers).toEqual({ Apikey: "master-key" })
    expect(String(services.capturedUrl)).toBe(
      "https://app.trivaralogistics.com/api/users/V2/Activity/get_services"
    )
    expect(services.capturedInit?.headers).toEqual({ Apikey: "master-key" })
    expect(String(partners.capturedUrl)).toBe(
      "https://app.trivaralogistics.com/api/users/V2/Activity/get_active_partners"
    )
    expect(partners.capturedInit?.headers).toEqual({ Apikey: "master-key" })
  })
})
