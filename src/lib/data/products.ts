"use server"

import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { Product } from "@/lib/supabase/types"
import { SortOptions } from "@modules/store/components/refinement-list/types"

import { normalizeProductImage } from "@lib/util/images"
import { ACTIVE_PRODUCT_STATUS } from "@lib/util/product-visibility"
import { getProductRange } from "@modules/store/utils/pagination"
import {
  MIN_SEARCH_QUERY_LENGTH,
  SEARCH_MAX_QUERY_LENGTH,
} from "@/lib/constants/search"

const normalizeProductSearchQuery = (value: string | string[] | undefined) => {
  const rawValue = Array.isArray(value) ? value[0] : value
  const normalized = rawValue?.trim().slice(0, SEARCH_MAX_QUERY_LENGTH)

  return normalized && normalized.length >= MIN_SEARCH_QUERY_LENGTH
    ? normalized
    : undefined
}

const PRODUCT_CARD_SELECT = `
  id,
  handle,
  name,
  short_description,
  price,
  currency_code,
  image_url,
  thumbnail,
  stock_count,
  metadata,
  category_id,
  collection_id,
  created_at,
  updated_at,
  status,
  variants:product_variants(
    id,
    title,
    price,
    compare_at_price,
    inventory_quantity,
    manage_inventory,
    allow_backorder,
    product_id,
    image_url,
    options
  )
`

const PRODUCT_DETAIL_SELECT = `
  id,
  handle,
  name,
  description,
  short_description,
  price,
  currency_code,
  image_url,
  video_url,
  thumbnail,
  images,
  stock_count,
  metadata,
  seo_title,
  seo_description,
  seo_metadata,
  category_id,
  collection_id,
  created_at,
  updated_at,
  subtitle,
  status,
  variants:product_variants(
    id,
    title,
    sku,
    barcode,
    price,
    compare_at_price,
    inventory_quantity,
    manage_inventory,
    allow_backorder,
    product_id,
    options,
    image_url
  ),
  options:product_options(
    id,
    title,
    values:product_option_values(
      id,
      value,
      option_id,
      metadata
    )
  ),
  related_combinations:product_combinations!product_id(
    id,
    product_id,
    related_product_id,
    related_product:products!related_product_id(
      ${PRODUCT_CARD_SELECT}
    )
  )
`

const PRODUCT_QUICK_VIEW_SELECT = `
  id,
  handle,
  name,
  short_description,
  price,
  currency_code,
  image_url,
  thumbnail,
  images,
  stock_count,
  metadata,
  category_id,
  collection_id,
  created_at,
  updated_at,
  subtitle,
  status,
  variants:product_variants(
    id,
    title,
    sku,
    barcode,
    price,
    compare_at_price,
    inventory_quantity,
    manage_inventory,
    allow_backorder,
    product_id,
    options,
    image_url
  ),
  options:product_options(
    id,
    title,
    values:product_option_values(
      id,
      value,
      option_id,
      metadata
    )
  )
`

type PriceFilteredProductVariantRow = {
  id: string
  title: string
  price: number
  compare_at_price: number | null
  inventory_quantity: number
  manage_inventory: boolean
  allow_backorder: boolean
  product_id: string
  image_url: string | null
  options: unknown
}

type PriceFilteredProductRow = {
  id: string
  handle: string
  name: string
  short_description: string | null
  price: number
  currency_code: string
  image_url: string | null
  thumbnail: string | null
  stock_count: number
  metadata: Record<string, unknown> | null
  category_id: string | null
  collection_id: string | null
  created_at: string
  updated_at: string
  status: Product["status"]
  variants: PriceFilteredProductVariantRow[] | null
  total_count: number | string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const toStringValue = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback

const toNullableStringValue = (value: unknown) =>
  typeof value === "string" ? value : null

const toNumberValue = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return fallback
}

const toBooleanValue = (value: unknown, fallback = false) =>
  typeof value === "boolean" ? value : fallback

const toMetadataValue = (value: unknown): Record<string, unknown> | null =>
  isRecord(value) ? value : null

const toVariantRows = (value: unknown): PriceFilteredProductVariantRow[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord).map((variant) => ({
    id: toStringValue(variant.id),
    title: toStringValue(variant.title),
    price: toNumberValue(variant.price),
    compare_at_price:
      variant.compare_at_price === null || variant.compare_at_price === undefined
        ? null
        : toNumberValue(variant.compare_at_price),
    inventory_quantity: toNumberValue(variant.inventory_quantity),
    manage_inventory: toBooleanValue(variant.manage_inventory, true),
    allow_backorder: toBooleanValue(variant.allow_backorder),
    product_id: toStringValue(variant.product_id),
    image_url: toNullableStringValue(variant.image_url),
    options: Array.isArray(variant.options) ? variant.options : [],
  }))
}

const mapPriceFilteredProductRow = (row: Record<string, unknown>): PriceFilteredProductRow => ({
  id: toStringValue(row.id),
  handle: toStringValue(row.handle),
  name: toStringValue(row.name),
  short_description: toNullableStringValue(row.short_description),
  price: toNumberValue(row.price),
  currency_code: toStringValue(row.currency_code, "INR"),
  image_url: toNullableStringValue(row.image_url),
  thumbnail: toNullableStringValue(row.thumbnail),
  stock_count: toNumberValue(row.stock_count),
  metadata: toMetadataValue(row.metadata),
  category_id: toNullableStringValue(row.category_id),
  collection_id: toNullableStringValue(row.collection_id),
  created_at: toStringValue(row.created_at),
  updated_at: toStringValue(row.updated_at),
  status: toStringValue(row.status, ACTIVE_PRODUCT_STATUS) as Product["status"],
  variants: toVariantRows(row.variants),
  total_count:
    typeof row.total_count === "number" || typeof row.total_count === "string"
      ? row.total_count
      : null,
})

const mapPriceFilteredRowsToProducts = (rows: unknown[]) =>
  rows
    .filter(isRecord)
    .map((row) => normalizeProductImage(mapPriceFilteredProductRow(row) as unknown as Product))

const getPriceFilteredCount = (rows: PriceFilteredProductRow[]) => {
  const firstCount = rows[0]?.total_count

  if (typeof firstCount === "number" && Number.isFinite(firstCount)) {
    return firstCount
  }

  if (typeof firstCount === "string") {
    const parsed = Number(firstCount)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export const listProducts = cache(async function listProducts(options: {
  regionId?: string
  queryParams?: {
    limit?: number
    collection_id?: string[]
    category_id?: string[]
    exclude_id?: string
  }
} = {}): Promise<{ response: { products: Product[]; count: number } }> {
  const supabase = await createClient()

  let selectString = PRODUCT_CARD_SELECT
  const joins: string[] = []

  if (options.queryParams?.collection_id?.length) {
    joins.push(`product_collections!inner(collection_id)`)
  }
  if (options.queryParams?.category_id?.length) {
    joins.push(`product_categories!inner(category_id)`)
  }

  if (joins.length > 0) {
    selectString = `${PRODUCT_CARD_SELECT}, ${joins.join(', ')}`
  }

  let query = supabase
    .from("products")
    .select(selectString, { count: "exact" })
    .eq("status", ACTIVE_PRODUCT_STATUS)

  if (options.queryParams?.collection_id?.length) {
    query = query.in("product_collections.collection_id", options.queryParams.collection_id)
  }

  if (options.queryParams?.category_id?.length) {
    query = query.in("product_categories.category_id", options.queryParams.category_id)
  }

  if (options.queryParams?.exclude_id) {
    query = query.neq("id", options.queryParams.exclude_id)
  }

  // Apply limit AFTER exclusions and filters
  if (options.queryParams?.limit) {
    query = query.limit(options.queryParams.limit)
  }

  const { data, count, error } = await query.order("created_at", { ascending: false })

  if (error) {
    console.error("Error listing products:", error.message)
    return { response: { products: [], count: 0 } }
  }

  const products = (data || []).map((p) => normalizeProductImage(p as unknown as Product))
  return { response: { products, count: count || 0 } }
})

export const retrieveProduct = cache(async function retrieveProduct(id: string): Promise<Product | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error || !data) return null
  return normalizeProductImage(data as unknown as Product)
})

export const getProductByHandle = cache(async function getProductByHandle(handle: string): Promise<Product | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_DETAIL_SELECT)
    .eq("status", ACTIVE_PRODUCT_STATUS)
    .eq("handle", handle)
    .maybeSingle()

  if (error || !data) return null
  return normalizeProductImage(data as unknown as Product)
})

export const listPaginatedProducts = cache(async function listPaginatedProducts({
  page = 1,
  limit = 12,
  sortBy = "featured",
  queryParams,
  priceFilter,
  availability,
  ageFilter: _ageFilter,
  includeDetails = false,
}: {
  page?: number
  limit?: number
  sortBy?: SortOptions
  countryCode?: string
  queryParams?: Record<string, string[] | string | undefined>
  availability?: string
  priceFilter?: { min?: number; max?: number }
  ageFilter?: string
  includeDetails?: boolean
}) {
  const supabase = await createClient()
  const range = getProductRange(page, limit)
  const productSelect = includeDetails ? PRODUCT_QUICK_VIEW_SELECT : PRODUCT_CARD_SELECT

  const categoryIds = queryParams?.category_id
    ? (Array.isArray(queryParams.category_id) ? queryParams.category_id : [queryParams.category_id])
    : []
  const collectionIds = queryParams?.collection_id
    ? (Array.isArray(queryParams.collection_id) ? queryParams.collection_id : [queryParams.collection_id])
    : []
  const productIds = queryParams?.id
    ? (Array.isArray(queryParams.id) ? queryParams.id : [queryParams.id])
    : []
  const searchQuery = normalizeProductSearchQuery(queryParams?.q)
  const needsDatabasePriceFiltering = priceFilter?.min !== undefined || priceFilter?.max !== undefined

  if (needsDatabasePriceFiltering) {
    const { data, error } = await supabase.rpc("list_storefront_products_by_price", {
      p_min_price: priceFilter?.min ?? null,
      p_max_price: priceFilter?.max ?? null,
      p_category_ids: categoryIds.length ? categoryIds : null,
      p_collection_ids: collectionIds.length ? collectionIds : null,
      p_product_ids: productIds.length ? productIds : null,
      p_search_query: searchQuery ?? null,
      p_availability: availability ?? null,
      p_sort_by: sortBy,
      p_offset: range.from,
      p_limit: range.limit,
    })

    if (error) {
      console.error("Error listing price-filtered products:", error.message)
      return { response: { products: [], count: 0 }, pagination: { page: range.page, limit: range.limit } }
    }

    const rows = (data ?? []).filter(isRecord).map(mapPriceFilteredProductRow)

    return {
      response: {
        products: mapPriceFilteredRowsToProducts(rows),
        count: getPriceFilteredCount(rows),
      },
      pagination: { page: range.page, limit: range.limit },
    }
  }

  // Determine if we need joins for category or collection filtering

  const needsCategoryJoin = categoryIds.length > 0
  const needsCollectionJoin = collectionIds.length > 0
  // Build query with the same filters as before, but use a lightweight select by default.
  const joins: string[] = []

  if (needsCategoryJoin) {
    joins.push("product_categories!inner(category_id)")
  }

  if (needsCollectionJoin) {
    joins.push("product_collections!inner(collection_id)")
  }

  const selectString = joins.length
    ? `${productSelect}, ${joins.join(", ")}`
    : productSelect

  let query = supabase
    .from("products")
    .select(selectString, { count: "exact" })

  query = query.eq("status", ACTIVE_PRODUCT_STATUS)

  // Chain filters WITHOUT recreating the query object
  if (needsCategoryJoin) {
    query = query.in("product_categories.category_id", categoryIds)
  }

  if (needsCollectionJoin) {
    query = query.in("product_collections.collection_id", collectionIds)
  }

  if (productIds.length) {
    query = query.in("id", productIds)
  }

  if (searchQuery) {
    query = query.ilike("name", `%${searchQuery}%`)
  }

  // Apply availability filter
  if (availability) {
    if (availability === 'in_stock') {
      query = query.gt("stock_count", 0)
    } else if (availability === 'out_of_stock') {
      query = query.eq("stock_count", 0)
    }
  }

  // Apply sorting
  const sortConfigs: Record<string, { col: string; asc: boolean }> = {
    price_asc: { col: "price", asc: true },
    price_desc: { col: "price", asc: false },
    alpha_asc: { col: "name", asc: true },
    alpha_desc: { col: "name", asc: false },
    featured: { col: "created_at", asc: false },
  }

  const sort = sortConfigs[sortBy] || sortConfigs.featured
  query = query.order(sort.col, { ascending: sort.asc })

  const { data, count, error } = await query.range(range.from, range.to)

  if (error) {
    return { response: { products: [], count: 0 }, pagination: { page: range.page, limit: range.limit } }
  }

  const products = (data || []).map((p) => normalizeProductImage(p as unknown as Product))

  return {
    response: {
      products,
      count: count || 0,
    },
    pagination: { page: range.page, limit: range.limit },
  }
})
