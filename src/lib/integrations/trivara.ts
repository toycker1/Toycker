import { Order } from "@/lib/supabase/types"
import { isCashOnDeliveryLikeOrder } from "@/lib/util/customer-order-state"

export type TrivaraPaymentMode = "PREPAID" | "COD"
export type TrivaraShipmentType = "PARCEL" | "DOCUMENT"
export type TrivaraService = "SURFACE" | "AIR" | "EXPRESS"

export type TrivaraOrderBookingPayload = {
  crn_no: string
  order_number: string
  consignee_name: string
  city: string
  state: string
  country: string
  address: string
  pincode: string
  mobile: string
  length: string
  width: string
  height: string
  weight: string
  payment_mode: TrivaraPaymentMode
  package_amount: string
  cod_amount: string
  product_detail: string
  shipment_type: TrivaraShipmentType
  service: TrivaraService
  seller_name: string
  seller_address: string
  seller_pincode: string
  seller_contact: string
  seller_email: string
  service_partner: string
  pickup_location_code: string
}

export type TrivaraConfig = {
  bookingEnabled: boolean
  apiBaseUrl: string
  apiKey: string
  crnNo: string
  pickupLocationCode: string
  service: TrivaraService
  shipmentType: TrivaraShipmentType
  servicePartner: string
  defaultWeightGrams: string
}

export type TrivaraOrderBookingResponse = {
  ok: boolean
  status: number
  referenceNumber: string | null
  responsePayload: Record<string, unknown>
}

export type TrivaraApiResponse = {
  ok: boolean
  status: number
  responsePayload: Record<string, unknown>
}

export type TrivaraTotalOrdersPayload = {
  crn_no: string
  start_date: string
  end_date: string
}

export type TrivaraReferencePayload = {
  crn_no: string
  reference_number: string
}

export type TrivaraCrnPayload = {
  crn_no: string
}

type FetchLike = (
  _input: string | URL,
  _init?: RequestInit
) => Promise<Response>

type OrderForTrivara = Pick<
  Order,
  | "id"
  | "display_id"
  | "total_amount"
  | "total"
  | "currency_code"
  | "shipping_address"
  | "payment_method"
  | "metadata"
  | "items"
>

const DEFAULT_TRIVARA_API_BASE_URL = "https://app.trivaralogistics.in"
const DEFAULT_TRIVARA_PRINT_SLIP_API_BASE_URL =
  "https://production.trivaralogistics.in"
const DEFAULT_TRIVARA_SERVICE: TrivaraService = "SURFACE"
const DEFAULT_TRIVARA_SHIPMENT_TYPE: TrivaraShipmentType = "PARCEL"
const DEFAULT_TRIVARA_WEIGHT_GRAMS = "1500"
const ORDER_BOOKING_PATH = "/api/users/V2/OrderBooking/create_order"
const ORDER_TRACKING_PATH = "/api/users/V2/OrderBooking/track_parcel"
const PRINT_SLIP_PATH = "/api/users/V2/OrderBooking/print_slip"
const TOTAL_ORDERS_PATH = "/api/users/V2/OrderBooking/get_total_orders"
const CANCEL_ORDER_PATH = "/api/users/V2/OrderBooking/cancel_multiple_orders"
const PICKUP_LOCATIONS_PATH = "/api/users/V2/OrderBooking/get_pickup_location"
const SERVICES_PATH = "/api/users/V2/Activity/get_services"

function getTrimmedEnv(key: string): string {
  return process.env[key]?.trim() || ""
}

function getRequiredEnv(key: string): string {
  const value = getTrimmedEnv(key)

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

function readService(value: string): TrivaraService {
  const normalized = value.trim().toUpperCase()

  if (
    normalized === "SURFACE" ||
    normalized === "AIR" ||
    normalized === "EXPRESS"
  ) {
    return normalized
  }

  return DEFAULT_TRIVARA_SERVICE
}

function readShipmentType(value: string): TrivaraShipmentType {
  const normalized = value.trim().toUpperCase()

  if (normalized === "PARCEL" || normalized === "DOCUMENT") {
    return normalized
  }

  return DEFAULT_TRIVARA_SHIPMENT_TYPE
}

export function getTrivaraConfig(): TrivaraConfig {
  const bookingEnabled = getTrimmedEnv("TRIVARA_BOOKING_ENABLED") === "true"

  return {
    bookingEnabled,
    apiBaseUrl:
      getTrimmedEnv("TRIVARA_API_BASE_URL") || DEFAULT_TRIVARA_API_BASE_URL,
    apiKey: bookingEnabled
      ? getRequiredEnv("TRIVARA_API_KEY")
      : getTrimmedEnv("TRIVARA_API_KEY"),
    crnNo: bookingEnabled
      ? getRequiredEnv("TRIVARA_CRN_NO")
      : getTrimmedEnv("TRIVARA_CRN_NO"),
    pickupLocationCode: bookingEnabled
      ? getRequiredEnv("TRIVARA_PICKUP_LOCATION_CODE")
      : getTrimmedEnv("TRIVARA_PICKUP_LOCATION_CODE"),
    service: readService(getTrimmedEnv("TRIVARA_SERVICE")),
    shipmentType: readShipmentType(getTrimmedEnv("TRIVARA_SHIPMENT_TYPE")),
    servicePartner: getTrimmedEnv("TRIVARA_SERVICE_PARTNER"),
    defaultWeightGrams:
      getTrimmedEnv("TRIVARA_DEFAULT_WEIGHT_GRAMS") ||
      DEFAULT_TRIVARA_WEIGHT_GRAMS,
  }
}

export function getTrivaraApiKey(): string {
  return getRequiredEnv("TRIVARA_API_KEY")
}

export function getTrivaraTrackingApiKey(): string {
  return getTrimmedEnv("TRIVARA_TRACKING_API_KEY") || getTrivaraApiKey()
}

export function getTrivaraMasterApiKey(): string {
  return getTrimmedEnv("TRIVARA_MASTER_API_KEY") || getTrivaraApiKey()
}

export function getTrivaraCrnNo(): string {
  return getRequiredEnv("TRIVARA_CRN_NO")
}

export function getTrivaraApiBaseUrl(): string {
  return getTrimmedEnv("TRIVARA_API_BASE_URL") || DEFAULT_TRIVARA_API_BASE_URL
}

export function getTrivaraPrintSlipApiBaseUrl(): string {
  return (
    getTrimmedEnv("TRIVARA_PRINT_SLIP_API_BASE_URL") ||
    DEFAULT_TRIVARA_PRINT_SLIP_API_BASE_URL
  )
}

function compactAddressPart(value: string | null | undefined): string {
  return value?.trim() || ""
}

function formatConsigneeName(order: OrderForTrivara): string {
  const firstName = compactAddressPart(order.shipping_address?.first_name)
  const lastName = compactAddressPart(order.shipping_address?.last_name)
  return `${firstName} ${lastName}`.trim()
}

function formatAddress(order: OrderForTrivara): string {
  return [
    order.shipping_address?.address_1,
    order.shipping_address?.address_2,
    order.shipping_address?.company,
  ]
    .map(compactAddressPart)
    .filter(Boolean)
    .join(", ")
}

function formatMobile(phone: string | null | undefined): string {
  const digits = compactAddressPart(phone).replace(/\D/g, "")

  if (digits.length > 10 && digits.startsWith("91")) {
    return digits.slice(-10)
  }

  return digits
}

function formatAmount(value: number | null | undefined): string {
  const amount = Number(value || 0)
  return Math.max(0, Math.round(amount)).toString()
}

function formatProductDetail(order: OrderForTrivara): string {
  const titles =
    order.items
      ?.map((item) => item.title?.trim())
      .filter((title): title is string => Boolean(title)) || []

  return titles.length > 0 ? titles.join(",") : `Toycker Order #${order.display_id}`
}

function requireField(value: string, label: string): string {
  if (!value.trim()) {
    throw new Error(`${label} is required for Trivara booking`)
  }

  return value.trim()
}

export function buildTrivaraOrderBookingPayload(
  order: OrderForTrivara,
  config: Pick<
    TrivaraConfig,
    | "crnNo"
    | "pickupLocationCode"
    | "service"
    | "shipmentType"
    | "servicePartner"
    | "defaultWeightGrams"
  >
): TrivaraOrderBookingPayload {
  const paymentMode: TrivaraPaymentMode = isCashOnDeliveryLikeOrder(order)
    ? "COD"
    : "PREPAID"
  const packageAmount = formatAmount(order.total_amount || order.total)

  return {
    crn_no: requireField(config.crnNo, "Trivara CRN number"),
    order_number: `ORD${order.display_id}`,
    consignee_name: requireField(formatConsigneeName(order), "Consignee name"),
    city: requireField(
      compactAddressPart(order.shipping_address?.city),
      "Shipping city"
    ),
    state: requireField(
      compactAddressPart(order.shipping_address?.province),
      "Shipping state"
    ),
    country: "India",
    address: requireField(formatAddress(order), "Shipping address"),
    pincode: requireField(
      compactAddressPart(order.shipping_address?.postal_code),
      "Shipping pincode"
    ),
    mobile: requireField(
      formatMobile(order.shipping_address?.phone),
      "Shipping mobile"
    ),
    length: "",
    width: "",
    height: "",
    weight: requireField(config.defaultWeightGrams, "Package weight"),
    payment_mode: paymentMode,
    package_amount: packageAmount,
    cod_amount: paymentMode === "COD" ? packageAmount : "",
    product_detail: requireField(formatProductDetail(order), "Product detail"),
    shipment_type: config.shipmentType,
    service: config.service,
    seller_name: "",
    seller_address: "",
    seller_pincode: "",
    seller_contact: "",
    seller_email: "",
    service_partner: config.servicePartner,
    pickup_location_code: requireField(
      config.pickupLocationCode,
      "Trivara pickup location code"
    ),
  }
}

function payloadToFormData(payload: object): FormData {
  const formData = new FormData()

  Object.entries(payload as Record<string, string>).forEach(([key, value]) => {
    formData.append(key, value)
  })

  return formData
}

async function parseTrivaraResponse(
  response: Response
): Promise<Record<string, unknown>> {
  const raw = await response.text()

  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }

    return { value: parsed }
  } catch {
    return { raw }
  }
}

function extractReferenceNumber(value: Record<string, unknown>): string | null {
  const queue: unknown[] = [value]
  const candidateKeys = new Set([
    "reference_number",
    "referenceNumber",
    "ref_no",
    "refNo",
    "awb",
    "awb_number",
    "tracking_number",
  ])

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current || typeof current !== "object" || Array.isArray(current)) {
      continue
    }

    Object.entries(current).forEach(([key, nestedValue]) => {
      if (typeof nestedValue === "string" && candidateKeys.has(key)) {
        queue.unshift({ __match: nestedValue })
      } else if (nestedValue && typeof nestedValue === "object") {
        queue.push(nestedValue)
      }
    })

    if (
      "__match" in current &&
      typeof (current as Record<string, unknown>).__match === "string"
    ) {
      return (current as Record<string, string>).__match
    }
  }

  return null
}

export async function sendTrivaraOrderBooking(
  payload: TrivaraOrderBookingPayload,
  config: Pick<TrivaraConfig, "apiBaseUrl" | "apiKey">,
  fetcher: FetchLike = fetch
): Promise<TrivaraOrderBookingResponse> {
  const url = new URL(ORDER_BOOKING_PATH, config.apiBaseUrl)
  const response = await fetcher(url, {
    method: "POST",
    headers: {
      Apikey: config.apiKey,
    },
    body: payloadToFormData(payload),
    cache: "no-store",
  })
  const responsePayload = await parseTrivaraResponse(response)

  return {
    ok: response.ok,
    status: response.status,
    referenceNumber: extractReferenceNumber(responsePayload),
    responsePayload,
  }
}

async function sendTrivaraFormRequest(
  path: string,
  payload: object,
  config: {
    apiBaseUrl: string
    apiKey: string
    apiKeyHeader: "Apikey" | "api_key"
  },
  fetcher: FetchLike = fetch
): Promise<TrivaraApiResponse> {
  const url = new URL(path, config.apiBaseUrl)
  const response = await fetcher(url, {
    method: "POST",
    headers: {
      [config.apiKeyHeader]: config.apiKey,
    },
    body: payloadToFormData(payload),
    cache: "no-store",
  })
  const responsePayload = await parseTrivaraResponse(response)

  return {
    ok: response.ok,
    status: response.status,
    responsePayload,
  }
}

export async function sendTrivaraOrderTracking(
  payload: TrivaraReferencePayload,
  config: { apiBaseUrl: string; apiKey: string },
  fetcher: FetchLike = fetch
): Promise<TrivaraApiResponse> {
  return sendTrivaraFormRequest(
    ORDER_TRACKING_PATH,
    payload,
    {
      ...config,
      apiKeyHeader: "api_key",
    },
    fetcher
  )
}

export async function sendTrivaraPrintSlip(
  payload: TrivaraReferencePayload,
  config: { apiBaseUrl: string; apiKey: string },
  fetcher: FetchLike = fetch
): Promise<TrivaraApiResponse> {
  return sendTrivaraFormRequest(
    PRINT_SLIP_PATH,
    payload,
    {
      ...config,
      apiKeyHeader: "Apikey",
    },
    fetcher
  )
}

export async function sendTrivaraTotalOrders(
  payload: TrivaraTotalOrdersPayload,
  config: { apiBaseUrl: string; apiKey: string },
  fetcher: FetchLike = fetch
): Promise<TrivaraApiResponse> {
  return sendTrivaraFormRequest(
    TOTAL_ORDERS_PATH,
    payload,
    {
      ...config,
      apiKeyHeader: "Apikey",
    },
    fetcher
  )
}

export async function sendTrivaraCancelOrder(
  payload: TrivaraReferencePayload,
  config: { apiBaseUrl: string; apiKey: string },
  fetcher: FetchLike = fetch
): Promise<TrivaraApiResponse> {
  return sendTrivaraFormRequest(
    CANCEL_ORDER_PATH,
    payload,
    {
      ...config,
      apiKeyHeader: "Apikey",
    },
    fetcher
  )
}

export async function sendTrivaraPickupLocations(
  payload: TrivaraCrnPayload,
  config: { apiBaseUrl: string; apiKey: string },
  fetcher: FetchLike = fetch
): Promise<TrivaraApiResponse> {
  return sendTrivaraFormRequest(
    PICKUP_LOCATIONS_PATH,
    payload,
    {
      ...config,
      apiKeyHeader: "api_key",
    },
    fetcher
  )
}

export async function sendTrivaraServices(
  payload: TrivaraCrnPayload,
  config: { apiBaseUrl: string; apiKey: string },
  fetcher: FetchLike = fetch
): Promise<TrivaraApiResponse> {
  return sendTrivaraFormRequest(
    SERVICES_PATH,
    payload,
    {
      ...config,
      apiKeyHeader: "api_key",
    },
    fetcher
  )
}
