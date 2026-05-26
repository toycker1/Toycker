import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCategoryByHandle, listCategories } from "@lib/data/categories"
import CategoryTemplate from "@modules/categories/templates"
import {
  AvailabilityFilter,
  isViewMode,
  SortOptions,
} from "@modules/store/components/refinement-list/types"
import { sanitizePriceRange } from "@modules/store/utils/price-range"
import { getClubSettings } from "@lib/data/club"

type Props = {
  params: Promise<{ category: string[] }>
  searchParams: Promise<{
    availability?: AvailabilityFilter
    price_min?: string
    price_max?: string
    sortBy?: SortOptions
    page?: string
    view?: string
  }>
}

export const revalidate = 300

export async function generateStaticParams() {
  const { categories } = await listCategories()

  if (!categories) {
    return []
  }

  const categoryHandles = categories.map((category) => category.handle)

  return categoryHandles.map((handle) => ({
    category: [handle],
  }))
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  try {
    const productCategory = await getCategoryByHandle(params.category)

    if (!productCategory) {
      notFound()
    }

    const title = productCategory.name + " | Toycker Store"

    const description = productCategory.description ?? `${title} category.`

    return {
      title: `${title} | Toycker Store`,
      description,
      alternates: {
        canonical: `${params.category.join("/")}`,
      },
    }
  } catch (error) {
    notFound()
  }
}

export default async function CategoryPage(props: Props) {
  const searchParams = await props.searchParams
  const params = await props.params
  const { availability, price_min, price_max, sortBy, page, view } = searchParams

  const productCategory = await getCategoryByHandle(params.category)

  if (!productCategory) {
    notFound()
  }

  const clubSettings = await getClubSettings()
  const parsedPriceRange = sanitizePriceRange({
    min: price_min !== undefined ? Number(price_min) : undefined,
    max: price_max !== undefined ? Number(price_max) : undefined,
  })

  return (
    <CategoryTemplate
      category={productCategory}
      availability={availability}
      priceRange={parsedPriceRange}
      sortBy={sortBy}
      page={page}
      viewMode={isViewMode(view) ? view : undefined}
      countryCode="in"
      clubDiscountPercentage={clubSettings?.discount_percentage}
    />
  )
}
