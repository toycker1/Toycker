"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { ReviewWithMedia } from "./reviews"

export type HomeReview = {
    id: string
    review_id: string
    sort_order: number
    created_at?: string
    review?: ReviewWithMedia
}

type StorefrontReviewMediaRow = {
    id: string
    file_path: string
    file_type: "image" | "video" | "audio"
}

type StorefrontReviewRow = {
    id: string
    rating: number
    title: string
    content: string
    display_name: string
    is_anonymous: boolean
    product_id: string
    review_media: StorefrontReviewMediaRow[] | null
}

type StorefrontHomeReviewRow = {
    id: string
    review_id: string
    sort_order: number
    review: StorefrontReviewRow | StorefrontReviewRow[] | null
}

type StorefrontReviewProductRow = {
    id: string
    name: string
    price: number
    image_url: string | null
}

const firstRelation = <T,>(value: T | T[] | null | undefined): T | null => {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
}

// =============================================
// List all featured reviews (admin view)
// =============================================
export async function listHomeReviewsAdmin() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("home_reviews")
        .select(`
            *,
            review:reviews (
                *,
                review_media (*)
            )
        `)
        .order("sort_order", { ascending: true })

    if (error) {
        console.error("Error fetching home reviews:", error)
        return { reviews: [] as HomeReview[], error: error.message }
    }

    // Fetch product names for these reviews
    const productIds = Array.from(new Set(data.map(hr => (Array.isArray(hr.review) ? hr.review[0] : hr.review)?.product_id).filter(Boolean)))

    const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .in("id", productIds)

    const productMap = new Map(products?.map(p => [p.id, p.name]) || [])

    const reviewsWithProductNames = data.map(hr => {
        const review = (Array.isArray(hr.review) ? hr.review[0] : hr.review) as unknown as ReviewWithMedia
        if (review) {
            review.product_name = productMap.get(review.product_id) || "Unknown Product"
        }
        return {
            ...hr,
            review
        }
    })

    return { reviews: reviewsWithProductNames as HomeReview[], error: null }
}

const listHomeReviewsStorefrontInternal = async (): Promise<HomeReview[]> => {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("home_reviews")
        .select(`
            id,
            review_id,
            sort_order,
            review:reviews (
                id,
                rating,
                title,
                content,
                display_name,
                is_anonymous,
                product_id,
                review_media (
                    id,
                    file_path,
                    file_type
                )
            )
        `)
        .order("sort_order", { ascending: true })
        .limit(12)

    if (error) {
        console.error("Error fetching storefront home reviews:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
        })
        return []
    }

    if (!data || data.length === 0) return []

    // Fetch product details for these reviews
    const rows = data as StorefrontHomeReviewRow[]
    const productIds = Array.from(
        new Set(
            rows
                .map((homeReview) => firstRelation(homeReview.review)?.product_id)
                .filter((productId): productId is string => Boolean(productId))
        )
    )

    let productMap = new Map<string, StorefrontReviewProductRow>()

    if (productIds.length > 0) {
        const { data: products } = await supabase
            .from("products")
            .select("id, name, price, image_url")
            .in("id", productIds)

        productMap = new Map(
            ((products ?? []) as StorefrontReviewProductRow[]).map((product) => [
                product.id,
                product,
            ])
        )
    }

    // Merge product data into review objects
    const mergedData = rows.map((homeReview) => {
        const review = firstRelation(homeReview.review) as unknown as ReviewWithMedia | null
        if (review && review.product_id) {
            const product = productMap.get(review.product_id) || null
            review.product = product
            review.product_name = product?.name || "Unknown Product"
        }
        return {
            ...homeReview,
            review: review
        }
    })

    return mergedData as HomeReview[]
}

const cachedListHomeReviewsStorefront = unstable_cache(
    listHomeReviewsStorefrontInternal,
    ["home-reviews", "storefront"],
    { revalidate: 3600, tags: ["home-reviews"] }
)

// =============================================
// Fetch featured reviews for storefront
// =============================================
export async function listHomeReviewsStorefront() {
    return cachedListHomeReviewsStorefront()
}

// =============================================
// Add a review to home page
// =============================================
export async function addHomeReview(reviewId: string) {
    const supabase = await createClient()

    // 1. Check current count
    const { count } = await supabase
        .from("home_reviews")
        .select("*", { count: "exact", head: true })

    if (count && count >= 12) {
        return { error: "Maximum of 12 reviews can be added to the home page." }
    }

    // 2. Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    // 3. Get next sort order
    const { data: maxOrderData } = await supabase
        .from("home_reviews")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle()

    const nextOrder = maxOrderData ? maxOrderData.sort_order + 1 : 0

    // 4. Add review
    const { data, error } = await supabase
        .from("home_reviews")
        .insert({
            review_id: reviewId,
            sort_order: nextOrder,
            created_by: user.id
        })
        .select()
        .single()

    if (error) {
        if (error.code === "23505") {
            return { error: "This review is already on the home page." }
        }
        return { error: error.message }
    }

    revalidateTag("home-reviews", "max")
    revalidatePath("/")
    revalidatePath("/admin/home-settings")

    return { review: data, error: null }
}

// =============================================
// Remove review from home page
// =============================================
export async function removeHomeReview(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("home_reviews")
        .delete()
        .eq("id", id)

    if (error) return { error: error.message }

    revalidateTag("home-reviews", "max")
    revalidatePath("/")
    revalidatePath("/admin/home-settings")

    return { success: true, error: null }
}

// =============================================
// Reorder home reviews
// =============================================
export async function reorderHomeReviews(ids: string[]) {
    const supabase = await createClient()

    // Map each ID to its new order
    const updates = ids.map((id, index) =>
        supabase
            .from("home_reviews")
            .update({ sort_order: index })
            .eq("id", id)
    )

    const results = await Promise.all(updates)
    const error = results.find(r => r.error)?.error

    if (error) {
        console.error("Error reordering home reviews:", error)
        return { error: error.message }
    }

    revalidateTag("home-reviews", "max")
    revalidatePath("/")
    revalidatePath("/admin/home-settings")

    return { success: true, error: null }
}
