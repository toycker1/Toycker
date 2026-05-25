import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCollectionByHandle, listCollections } from "@lib/data/collections"
import { Collection } from "@/lib/supabase/types"
import CollectionTemplate from "@modules/collections/templates"
import {
  AvailabilityFilter,
  isViewMode,
  PriceRangeFilter,
  SortOptions,
} from "@modules/store/components/refinement-list/types"
import { sanitizePriceRange } from "@modules/store/utils/price-range"
import { getClubSettings } from "@lib/data/club"

type Props = {
  params: Promise<{ handle: string }>
  searchParams: Promise<{
    availability?: AvailabilityFilter
    page?: string
    price_min?: string
    price_max?: string
    sortBy?: SortOptions
    view?: string
  }>
}

export const PRODUCT_LIMIT = 12
export const revalidate = 300

export async function generateStaticParams() {
  const { collections } = await listCollections()

  if (!collections) {
    return []
  }

  return collections.map((collection: Collection) => ({
    handle: collection.handle,
  }))
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const collection = await getCollectionByHandle(decodeURIComponent(params.handle))

  if (!collection) {
    notFound()
  }

  return {
    title: `${collection.title} | Toycker Store`,
    description: `${collection.title} collection`,
  }
}

export default async function CollectionPage(props: Props) {
  const searchParams = await props.searchParams
  const params = await props.params
  const { availability, sortBy, page, price_min, price_max, view } = searchParams

  const collection = await getCollectionByHandle(decodeURIComponent(params.handle))

  if (!collection) {
    notFound()
  }

  const clubSettings = await getClubSettings()
  const parsedPriceRange: PriceRangeFilter | undefined = sanitizePriceRange({
    min: price_min !== undefined ? Number(price_min) : undefined,
    max: price_max !== undefined ? Number(price_max) : undefined,
  })

  return (
    <CollectionTemplate
      collection={collection}
      availability={availability}
      priceRange={parsedPriceRange}
      page={page}
      sortBy={sortBy}
      viewMode={isViewMode(view) ? view : undefined}
      countryCode="in"
      clubDiscountPercentage={clubSettings?.discount_percentage}
    />
  )
}
