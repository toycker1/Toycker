"use server"

import { createClient } from "@/lib/supabase/server"
import {
    MIN_SEARCH_QUERY_LENGTH,
    SEARCH_DEFAULT_PRODUCT_LIMIT,
    SEARCH_DEFAULT_TAXONOMY_LIMIT,
    SEARCH_MAX_PRODUCT_LIMIT,
    SEARCH_MAX_QUERY_LENGTH,
    SEARCH_MAX_TAXONOMY_LIMIT,
} from "@/lib/constants/search"

export type SearchProductSummary = {
    id: string
    title: string
    handle: string
    thumbnail?: string | null
    price?: {
        amount: number
        currencyCode: string
        formatted: string
    }
}

export type SearchCategorySummary = {
    id: string
    name: string
    handle: string
}

export type SearchCollectionSummary = {
    id: string
    title: string
    handle: string
}

export type SearchResultsPayload = {
    products: SearchProductSummary[]
    categories: SearchCategorySummary[]
    collections: SearchCollectionSummary[]
    suggestions: string[]
}

type SearchEntitiesArgs = {
    query: string
    countryCode: string
    productLimit?: number
    taxonomyLimit?: number
}

type SearchProductRow = {
    id: string
    name: string
    handle: string
    image_url: string | null
    thumbnail: string | null
    price: number | string | null
    currency_code: string | null
}

const clampLimit = (value: number | undefined, fallback: number, max: number) => {
    if (value === undefined || !Number.isFinite(value) || value < 1) {
        return fallback
    }

    return Math.min(Math.floor(value), max)
}

const normalizeSearchQuery = (value: string) =>
    value.trim().slice(0, SEARCH_MAX_QUERY_LENGTH)

const normalizePrice = (value: SearchProductRow["price"]) => {
    if (typeof value === "number") {
        return value
    }

    if (typeof value === "string") {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }

    return 0
}

export const searchEntities = async ({
    query,
    countryCode: _countryCode,
    productLimit,
    taxonomyLimit,
}: SearchEntitiesArgs): Promise<SearchResultsPayload> => {
    const normalizedQuery = normalizeSearchQuery(query)

    if (normalizedQuery.length < MIN_SEARCH_QUERY_LENGTH) {
        return { products: [], categories: [], collections: [], suggestions: [] }
    }

    const resolvedProductLimit = clampLimit(
        productLimit,
        SEARCH_DEFAULT_PRODUCT_LIMIT,
        SEARCH_MAX_PRODUCT_LIMIT
    )
    const resolvedTaxonomyLimit = clampLimit(
        taxonomyLimit,
        SEARCH_DEFAULT_TAXONOMY_LIMIT,
        SEARCH_MAX_TAXONOMY_LIMIT
    )

    const supabase = await createClient()

    // 1. Parallelize queries for speed
    const [productsRes, categoriesRes, collectionsRes] = await Promise.all([
        // Search Products using Advanced Multimodal RPC (FTS part only for now)
        supabase.rpc("search_products_multimodal", {
            search_query: normalizedQuery,
            match_count: resolvedProductLimit,
            match_threshold: 0.1,
        }),

        // Search Categories
        supabase
            .from("categories")
            .select("id, name, handle")
            .ilike("name", `%${normalizedQuery}%`)
            .limit(resolvedTaxonomyLimit),

        // Search Collections
        supabase
            .from("collections")
            .select("id, title, handle")
            .ilike("title", `%${normalizedQuery}%`)
            .limit(resolvedTaxonomyLimit),
    ])

    // 2. Process results (Normalization)
    const products = ((productsRes.data || []) as SearchProductRow[]).map((p) => ({
        id: p.id,
        title: p.name,
        handle: p.handle,
        thumbnail: p.image_url || p.thumbnail,
        price: {
            amount: normalizePrice(p.price),
            currencyCode: p.currency_code || "INR",
            formatted: `₹${p.price}`,
        },
    }))


    const categories = (categoriesRes.data || []).map((c: { id: string; name: string; handle: string }) => ({
        id: c.id,
        name: c.name,
        handle: c.handle,
    }))

    const collections = (collectionsRes.data || []).map((c: { id: string; title: string; handle: string }) => ({
        id: c.id,
        title: c.title,
        handle: c.handle,
    }))

    // 3. Generate Smart Suggestions
    const suggestionPool = [
        normalizedQuery,
        ...products.map((p: { title: string }) => p.title),
        ...categories.map((c: { name: string }) => c.name),
    ]

    const uniqueSuggestions = Array.from(new Set(suggestionPool)).slice(0, 6)

    return {
        products,
        categories,
        collections,
        suggestions: uniqueSuggestions,
    }
}

