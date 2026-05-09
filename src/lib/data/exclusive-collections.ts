"use server"

import { createClient } from "@/lib/supabase/server"
import { unstable_cache } from "next/cache"

export type ExclusiveCollectionProduct = {
  id: string
  name: string
  handle: string
  image_url: string | null
  thumbnail: string | null
  price: number
  currency_code: string | null
}

export type ExclusiveCollectionEntry = {
  id: string
  product_id: string
  video_url: string
  poster_url: string | null
  video_duration: number | null
  sort_order: number
  product: ExclusiveCollectionProduct | null
}

type ExclusiveCollectionRow = Omit<ExclusiveCollectionEntry, "product"> & {
  product: ExclusiveCollectionProduct | ExclusiveCollectionProduct[] | null
}

const firstRelation = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

export const listExclusiveCollections = unstable_cache(
  async ({
    regionId: _regionId,
  }: {
    regionId: string
  }): Promise<ExclusiveCollectionEntry[]> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("home_exclusive_collections")
      .select(`
        id,
        product_id,
        video_url,
        poster_url,
        video_duration,
        sort_order,
        product:products (
          id,
          name,
          handle,
          image_url,
          thumbnail,
          price,
          currency_code
        )
      `)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (error) {
      console.warn("Error fetching exclusive collections:", error)
      return []
    }

    if (!data || data.length === 0) {
      return []
    }

    return (data as unknown as ExclusiveCollectionRow[]).map((entry) => ({
      ...entry,
      product: firstRelation(entry.product),
    }))
  },
  ["exclusive-collections"],
  { revalidate: 3600, tags: ["exclusive-collections"] }
)
