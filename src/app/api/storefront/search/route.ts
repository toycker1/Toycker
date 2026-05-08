import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { searchEntities } from "@lib/data/search"
import {
  MIN_SEARCH_QUERY_LENGTH,
  SEARCH_DEFAULT_PRODUCT_LIMIT,
  SEARCH_DEFAULT_TAXONOMY_LIMIT,
  SEARCH_MAX_PRODUCT_LIMIT,
  SEARCH_MAX_QUERY_LENGTH,
  SEARCH_MAX_TAXONOMY_LIMIT,
} from "@/lib/constants/search"

const emptySearchResults = {
  products: [],
  categories: [],
  collections: [],
  suggestions: [],
}

const normalizeLimit = (value: string | null, fallback: number, max: number) => {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return Math.min(Math.floor(parsed), max)
}

const normalizeSearchQuery = (value: string) =>
  value.trim().slice(0, SEARCH_MAX_QUERY_LENGTH)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = normalizeSearchQuery(searchParams.get("q") ?? "")

    if (query.length < MIN_SEARCH_QUERY_LENGTH) {
      return NextResponse.json(emptySearchResults)
    }

    const countryParam = searchParams.get("countryCode")
    const cookieCountry = (await cookies()).get("country_code")?.value
    const countryCode = countryParam || cookieCountry
    const productLimit = normalizeLimit(
      searchParams.get("productLimit"),
      SEARCH_DEFAULT_PRODUCT_LIMIT,
      SEARCH_MAX_PRODUCT_LIMIT
    )
    const taxonomyLimit = normalizeLimit(
      searchParams.get("taxonomyLimit"),
      SEARCH_DEFAULT_TAXONOMY_LIMIT,
      SEARCH_MAX_TAXONOMY_LIMIT
    )

    if (!countryCode) {
      return NextResponse.json(
        { message: "countryCode is required" },
        { status: 400 }
      )
    }

    const results = await searchEntities({
      query,
      countryCode,
      productLimit,
      taxonomyLimit,
    })

    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load search results"
    return NextResponse.json({ message }, { status: 500 })
  }
}
