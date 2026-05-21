import { Order } from "@/lib/supabase/types"
import { isCashOnDeliveryLikeOrder } from "@/lib/util/customer-order-state"

export type TrivaraPaymentMode = "PREPAID" | "COD"
export type TrivaraShipmentType = "PARCEL" | "DOCUMENT"
export type TrivaraService = "SURFACE" | "AIR" | "EXPRESS"

export type TrivaraOrderBookingItem = {
  product_detail: string
  package_amount: number
  product_sku: string
  quantity: number
}

export type TrivaraOrderBookingOrder = {
  user_reference_id: string
  user_order_id: number
  consignee_name: string
  mobile: string
  pincode: string
  address: string
  payment_mode: TrivaraPaymentMode
  service: TrivaraService
  shipment_type: TrivaraShipmentType
  length: number
  width: number
  height: number
  weight: number
  email: string
  total_amount: number
  total_cod_amount: number
  items: TrivaraOrderBookingItem[]
}

export type TrivaraOrderBookingPayload = {
  warehouse_name: string
  service_partner_id: number
  crn_no: string
  orders: TrivaraOrderBookingOrder[]
}

export type TrivaraConfig = {
  bookingEnabled: boolean
  apiBaseUrl: string
  apiKey: string
  crnNo: string
  warehouseName: string
  service: TrivaraService
  shipmentType: TrivaraShipmentType
  servicePartnerId: number
  defaultWeightGrams: number
  defaultLengthCm: number
  defaultWidthCm: number
  defaultHeightCm: number
}

export type TrivaraOrderBookingResponse = {
  ok: boolean
  status: number
  referenceNumber: string | null
  errorMessage: string | null
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

export type TrivaraTrackingPayload = {
  crn_no: string
  action: "track"
  waybill: string
}

export type TrivaraPrintSlipPayload = {
  crn_no: string
  reference_number: string
  awb_number: string
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
  | "customer_email"
  | "email"
  | "total_amount"
  | "total"
  | "currency_code"
  | "shipping_address"
  | "payment_method"
  | "metadata"
  | "items"
>

type FormValue = string | number | boolean | null | undefined

const DEFAULT_TRIVARA_API_BASE_URL = "https://app.trivaralogistics.com"
const DEFAULT_TRIVARA_SERVICE: TrivaraService = "SURFACE"
const DEFAULT_TRIVARA_SHIPMENT_TYPE: TrivaraShipmentType = "PARCEL"
const DEFAULT_TRIVARA_WEIGHT_GRAMS = 500
const DEFAULT_TRIVARA_LENGTH_CM = 20
const DEFAULT_TRIVARA_WIDTH_CM = 15
const DEFAULT_TRIVARA_HEIGHT_CM = 10
const ORDER_BOOKING_PATH = "/api/users/V2/OrderBooking/create_order"
const ORDER_TRACKING_PATH = "/api/users/V2/OrderBooking/track_parcel"
const PRINT_SLIP_PATH = "/api/users/V2/OrderBooking/print_slip"
const TOTAL_ORDERS_PATH = "/api/users/V2/OrderBooking/get_total_orders"
const CANCEL_ORDER_PATH = "/api/users/V2/OrderBooking/cancel_order"
const PICKUP_LOCATIONS_PATH = "/api/users/V2/OrderBooking/get_pickup_location"
const SERVICES_PATH = "/api/users/V2/Activity/get_services"
const ACTIVE_PARTNERS_PATH = "/api/users/V2/Activity/get_active_partners"

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

function getValidBaseUrl(value: string, envKey: string): string {
  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error(`Missing required environment variable: ${envKey}`)
  }

  try {
    const url = new URL(trimmed)

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Invalid protocol")
    }

    return url.toString().replace(/\/$/, "")
  } catch {
    throw new Error(
      `${envKey} must be a full URL starting with https:// or http://`
    )
  }
}

function getOptionalValidBaseUrl(
  envKey: string,
  defaultValue: string
): string {
  return getValidBaseUrl(getTrimmedEnv(envKey) || defaultValue, envKey)
}

function getErrorCauseDetail(error: unknown): string {
  if (!error || typeof error !== "object" || !("cause" in error)) {
    return ""
  }

  const cause = (error as { cause?: unknown }).cause
  if (!cause || typeof cause !== "object") {
    return ""
  }

  const values = cause as {
    code?: unknown
    hostname?: unknown
    syscall?: unknown
  }
  const parts = [values.code, values.hostname, values.syscall].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  )

  return parts.length > 0 ? ` (${parts.join(" ")})` : ""
}

function formatTrivaraNetworkError(url: URL, error: unknown): Error {
  const message = error instanceof Error ? error.message : "Unknown error"
  return new Error(
    `Trivara request failed before receiving a response${getErrorCauseDetail(
      error
    )}: ${message}. URL: ${url.origin}`
  )
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

function readPositiveNumber(value: string, defaultValue: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue
}

function readRequiredPositiveInteger(value: string, envKey: string): number {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${envKey} must be a positive numeric partner ID`)
  }

  return parsed
}

export function getTrivaraConfig(): TrivaraConfig {
  const bookingEnabled = getTrimmedEnv("TRIVARA_BOOKING_ENABLED") === "true"
  const servicePartnerIdValue =
    getTrimmedEnv("TRIVARA_SERVICE_PARTNER_ID") ||
    getTrimmedEnv("TRIVARA_SERVICE_PARTNER")
  const warehouseName = getTrimmedEnv("TRIVARA_WAREHOUSE_NAME")

  const config = {
    bookingEnabled,
    apiBaseUrl: getOptionalValidBaseUrl(
      "TRIVARA_API_BASE_URL",
      DEFAULT_TRIVARA_API_BASE_URL
    ),
    apiKey: bookingEnabled
      ? getRequiredEnv("TRIVARA_API_KEY")
      : getTrimmedEnv("TRIVARA_API_KEY"),
    crnNo: bookingEnabled
      ? getRequiredEnv("TRIVARA_CRN_NO")
      : getTrimmedEnv("TRIVARA_CRN_NO"),
    warehouseName,
    service: readService(getTrimmedEnv("TRIVARA_SERVICE")),
    shipmentType: readShipmentType(getTrimmedEnv("TRIVARA_SHIPMENT_TYPE")),
    servicePartnerId: servicePartnerIdValue
      ? readRequiredPositiveInteger(
          servicePartnerIdValue,
          "TRIVARA_SERVICE_PARTNER_ID"
        )
      : 0,
    defaultWeightGrams: readPositiveNumber(
      getTrimmedEnv("TRIVARA_DEFAULT_WEIGHT_GRAMS"),
      DEFAULT_TRIVARA_WEIGHT_GRAMS
    ),
    defaultLengthCm: readPositiveNumber(
      getTrimmedEnv("TRIVARA_DEFAULT_LENGTH_CM"),
      DEFAULT_TRIVARA_LENGTH_CM
    ),
    defaultWidthCm: readPositiveNumber(
      getTrimmedEnv("TRIVARA_DEFAULT_WIDTH_CM"),
      DEFAULT_TRIVARA_WIDTH_CM
    ),
    defaultHeightCm: readPositiveNumber(
      getTrimmedEnv("TRIVARA_DEFAULT_HEIGHT_CM"),
      DEFAULT_TRIVARA_HEIGHT_CM
    ),
  }

  if (bookingEnabled && !servicePartnerIdValue) {
    throw new Error("Missing required environment variable: TRIVARA_SERVICE_PARTNER_ID")
  }

  if (bookingEnabled && !warehouseName) {
    throw new Error("Missing required environment variable: TRIVARA_WAREHOUSE_NAME")
  }

  return config
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
  return getOptionalValidBaseUrl(
    "TRIVARA_API_BASE_URL",
    DEFAULT_TRIVARA_API_BASE_URL
  )
}

export function getTrivaraPrintSlipApiBaseUrl(): string {
  return getOptionalValidBaseUrl(
    "TRIVARA_PRINT_SLIP_API_BASE_URL",
    DEFAULT_TRIVARA_API_BASE_URL
  )
}

export function getTrivaraServicesApiBaseUrl(): string {
  return getOptionalValidBaseUrl(
    "TRIVARA_SERVICES_API_BASE_URL",
    DEFAULT_TRIVARA_API_BASE_URL
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

function formatAmountNumber(value: number | null | undefined): number {
  return Number(formatAmount(value))
}

function formatProductDetail(order: OrderForTrivara): string {
  const titles =
    order.items
      ?.map((item) => item.title?.trim())
      .filter((title): title is string => Boolean(title)) || []

  return titles.length > 0 ? titles.join(",") : `Toycker Order #${order.display_id}`
}

function formatProductSku(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback
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
    | "warehouseName"
    | "service"
    | "shipmentType"
    | "servicePartnerId"
    | "defaultWeightGrams"
    | "defaultLengthCm"
    | "defaultWidthCm"
    | "defaultHeightCm"
  >
): TrivaraOrderBookingPayload {
  const paymentMode: TrivaraPaymentMode = isCashOnDeliveryLikeOrder(order)
    ? "COD"
    : "PREPAID"
  const packageAmount = formatAmountNumber(order.total_amount || order.total)
  const orderItems = order.items || []

  return {
    warehouse_name: requireField(config.warehouseName, "Trivara warehouse name"),
    service_partner_id: config.servicePartnerId,
    crn_no: requireField(config.crnNo, "Trivara CRN number"),
    orders: [
      {
        user_reference_id: `toycker_${order.id}`,
        user_order_id: order.display_id,
        consignee_name: requireField(formatConsigneeName(order), "Consignee name"),
        mobile: requireField(
          formatMobile(order.shipping_address?.phone),
          "Shipping mobile"
        ),
        pincode: requireField(
          compactAddressPart(order.shipping_address?.postal_code),
          "Shipping pincode"
        ),
        address: requireField(formatAddress(order), "Shipping address"),
        payment_mode: paymentMode,
        service: config.service,
        shipment_type: config.shipmentType,
        length: config.defaultLengthCm,
        width: config.defaultWidthCm,
        height: config.defaultHeightCm,
        weight: config.defaultWeightGrams,
        email: requireField(order.customer_email || order.email, "Customer email"),
        total_amount: packageAmount,
        total_cod_amount: paymentMode === "COD" ? packageAmount : 0,
        items:
          orderItems.length > 0
            ? orderItems.map((item, index) => ({
                product_detail: requireField(
                  item.title || item.product_title || formatProductDetail(order),
                  "Product detail"
                ),
                package_amount: formatAmountNumber(item.total || item.unit_price),
                product_sku: formatProductSku(
                  item.variant?.sku,
                  `${order.display_id}-${index + 1}`
                ),
                quantity: item.quantity || 1,
              }))
            : [
                {
                  product_detail: requireField(
                    formatProductDetail(order),
                    "Product detail"
                  ),
                  package_amount: packageAmount,
                  product_sku: String(order.display_id),
                  quantity: 1,
                },
              ],
      },
    ],
  }
}

function payloadToFormData(payload: Record<string, FormValue>): FormData {
  const formData = new FormData()

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, String(value))
    }
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

export function extractTrivaraReferenceNumber(
  value: Record<string, unknown>
): string | null {
  return extractTrivaraPayloadString(value, [
    "reference_number",
    "referenceNumber",
    "ref_no",
    "refNo",
  ])
}

export function extractTrivaraWaybillNumber(
  value: Record<string, unknown> | null
): string | null {
  if (!value) {
    return null
  }

  return extractTrivaraPayloadString(value, [
    "waybill",
    "waybill_no",
    "awb",
    "awb_number",
    "tracking_number",
  ])
}

export function extractTrivaraTrackingStatus(
  value: Record<string, unknown> | null
): string | null {
  if (!value) {
    return null
  }

  return (
    extractTrivaraPayloadString(value, [
      "current_state",
      "current_status",
      "shipment_status",
      "tracking_status",
    ]) || extractTrivaraPayloadString(value, ["status", "message"])
  )
}

function extractTrivaraPayloadString(
  value: Record<string, unknown>,
  candidateKeys: string[]
): string | null {
  const queue: unknown[] = [value]

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current || typeof current !== "object") {
      continue
    }

    if (Array.isArray(current)) {
      queue.push(...current)
      continue
    }

    const record = current as Record<string, unknown>

    for (const key of candidateKeys) {
      const nestedValue = record[key]

      if (typeof nestedValue === "string" && nestedValue.trim()) {
        return nestedValue.trim()
      }

      if (typeof nestedValue === "number") {
        return String(nestedValue)
      }
    }

    Object.values(record).forEach((nestedValue) => {
      if (nestedValue && typeof nestedValue === "object") {
        queue.push(nestedValue)
      }
    })
  }

  return null
}

function getStringValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

export function getTrivaraResponseBusinessError(
  value: Record<string, unknown>
): string | null {
  const queue: unknown[] = [value]

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current || typeof current !== "object" || Array.isArray(current)) {
      continue
    }

    const record = current as Record<string, unknown>
    const status = getStringValue(record.status)?.toLowerCase()
    const success = record.success
    const error = getStringValue(record.error)
    const message = getStringValue(record.message)

    if (error) {
      return error
    }

    if (status && ["error", "failed", "failure"].includes(status)) {
      return message || "Trivara returned an error response."
    }

    if (typeof success === "string") {
      const normalized = success.trim().toLowerCase()
      if (["0", "false", "failed", "error"].includes(normalized)) {
        return message || "Trivara returned an unsuccessful response."
      }
    }

    if (success === false) {
      return message || "Trivara returned an unsuccessful response."
    }

    Object.values(record).forEach((nestedValue) => {
      if (nestedValue && typeof nestedValue === "object") {
        if (Array.isArray(nestedValue)) {
          queue.push(...nestedValue)
        } else {
          queue.push(nestedValue)
        }
      }
    })
  }

  return null
}

export async function sendTrivaraOrderBooking(
  payload: TrivaraOrderBookingPayload,
  config: Pick<TrivaraConfig, "apiBaseUrl" | "apiKey">,
  fetcher: FetchLike = fetch
): Promise<TrivaraOrderBookingResponse> {
  const url = new URL(ORDER_BOOKING_PATH, config.apiBaseUrl)
  let response: Response

  try {
    response = await fetcher(url, {
      method: "POST",
      headers: {
        Apikey: config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    })
  } catch (error) {
    throw formatTrivaraNetworkError(url, error)
  }

  const responsePayload = await parseTrivaraResponse(response)

  return {
    ok: response.ok && !getTrivaraResponseBusinessError(responsePayload),
    status: response.status,
    referenceNumber: extractTrivaraReferenceNumber(responsePayload),
    errorMessage: getTrivaraResponseBusinessError(responsePayload),
    responsePayload,
  }
}

async function sendTrivaraFormRequest(
  path: string,
  payload: Record<string, FormValue>,
  config: {
    apiBaseUrl: string
    apiKey: string
    apiKeyHeader: "Apikey" | "api_key"
  },
  fetcher: FetchLike = fetch
): Promise<TrivaraApiResponse> {
  const url = new URL(path, config.apiBaseUrl)
  let response: Response

  try {
    response = await fetcher(url, {
      method: "POST",
      headers: {
        [config.apiKeyHeader]: config.apiKey,
      },
      body: payloadToFormData(payload),
      cache: "no-store",
    })
  } catch (error) {
    throw formatTrivaraNetworkError(url, error)
  }

  const responsePayload = await parseTrivaraResponse(response)
  const businessError = getTrivaraResponseBusinessError(responsePayload)

  return {
    ok: response.ok && !businessError,
    status: response.status,
    responsePayload,
  }
}

export async function sendTrivaraOrderTracking(
  payload: TrivaraTrackingPayload,
  config: { apiBaseUrl: string; apiKey: string },
  fetcher: FetchLike = fetch
): Promise<TrivaraApiResponse> {
  return sendTrivaraFormRequest(
    ORDER_TRACKING_PATH,
    payload,
    {
      ...config,
      apiKeyHeader: "Apikey",
    },
    fetcher
  )
}

export async function sendTrivaraPrintSlip(
  payload: TrivaraPrintSlipPayload,
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
      apiKeyHeader: "Apikey",
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
      apiKeyHeader: "Apikey",
    },
    fetcher
  )
}

export async function sendTrivaraActivePartners(
  payload: TrivaraCrnPayload,
  config: { apiBaseUrl: string; apiKey: string },
  fetcher: FetchLike = fetch
): Promise<TrivaraApiResponse> {
  return sendTrivaraFormRequest(
    ACTIVE_PARTNERS_PATH,
    payload,
    {
      ...config,
      apiKeyHeader: "Apikey",
    },
    fetcher
  )
}
