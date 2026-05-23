"use server"

import { unstable_cache } from "next/cache"

import type { Product } from "@/lib/supabase/types"
import { createClient } from "@/lib/supabase/server"
import { ACTIVE_PRODUCT_STATUS } from "@lib/util/product-visibility"
import { fixUrl } from "@lib/util/images"
import { getCollectionByHandle } from "@lib/data/collections"

type HomeProductVariantRow = {
  id: string
  price: number
  compare_at_price: number | null
}

export type HomeProductCard = {
  id: string
  handle: string
  name: string
  price: number
  currency_code: string
  image_url: string | null
  thumbnail: string | null
  images: string[]
  metadata: Record<string, unknown> | null
  variants: HomeProductVariantRow[]
}

type HomeProductCardRow = Omit<HomeProductCard, "image_url" | "thumbnail" | "images" | "variants"> & {
  image_url: string | null
  thumbnail: string | null
  images: Product["images"]
  variants: HomeProductVariantRow[] | null
}

type ListHomeCollectionProductCardsArgs = {
  handle: string
  limit: number
  collectionId?: string
}

const HOME_PRODUCT_CARD_SELECT = `
  id,
  handle,
  name,
  price,
  currency_code,
  image_url,
  thumbnail,
  images,
  metadata,
  variants:product_variants (
    id,
    price,
    compare_at_price
  )
`

const normalizeCard = (row: HomeProductCardRow): HomeProductCard => {
  const imageUrl = fixUrl(row.image_url)
  const thumbnail = fixUrl(row.thumbnail) ?? imageUrl
  const rawImages = Array.isArray(row.images) ? row.images : []
  const images = rawImages
    .map((image) => {
      if (typeof image === "string") {
        return fixUrl(image)
      }

      return fixUrl(image.url)
    })
    .filter((url): url is string => Boolean(url))

  return {
    ...row,
    image_url: imageUrl,
    thumbnail,
    images: Array.from(new Set(images)),
    variants: row.variants ?? [],
  }
}

const listHomeCollectionProductCardsInternal = async ({
  handle,
  limit,
  collectionId,
}: ListHomeCollectionProductCardsArgs): Promise<HomeProductCard[]> => {
  const supabase = await createClient()
  let resolvedCollectionId = collectionId

  if (!resolvedCollectionId) {
    const collection = await getCollectionByHandle(handle)
    resolvedCollectionId = collection?.id
  }

  if (resolvedCollectionId) {
    const { data, error } = await supabase
      .from("products")
      .select(`${HOME_PRODUCT_CARD_SELECT}, product_collections!inner(collection_id)`)
      .eq("status", ACTIVE_PRODUCT_STATUS)
      .in("product_collections.collection_id", [resolvedCollectionId])
      .order("created_at", { ascending: false })
      .limit(limit)

    if (!error && data && data.length > 0) {
      return (data as HomeProductCardRow[]).map(normalizeCard)
    }

    if (error) {
      console.error("Error fetching homepage collection products:", error.message)
    }
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("products")
    .select(HOME_PRODUCT_CARD_SELECT)
    .eq("status", ACTIVE_PRODUCT_STATUS)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (fallbackError) {
    console.error("Error fetching fallback homepage products:", fallbackError.message)
    return []
  }

  return ((fallbackData ?? []) as HomeProductCardRow[]).map(normalizeCard)
}

export const listHomeCollectionProductCards = async (
  args: ListHomeCollectionProductCardsArgs
) =>
  unstable_cache(
    () => listHomeCollectionProductCardsInternal(args),
    [
      "home-product-cards",
      args.handle,
      String(args.limit),
      args.collectionId ?? "auto",
    ],
    { revalidate: 3600, tags: ["products", "collections"] }
  )()
