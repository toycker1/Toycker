import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateImageEmbedding } from "@/lib/ml/embeddings"

const EMBEDDING_BACKFILL_BATCH_SIZE = 10

export async function GET() {
    return NextResponse.json(
        { error: "Method not allowed" },
        { status: 405 }
    )
}

export async function POST() {
    try {
        const userSupabase = await createClient()
        const {
            data: { user },
        } = await userSupabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { data: profile } = await userSupabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single()

        if (profile?.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const supabase = await createAdminClient()

        const { data: products, error: fetchError } = await supabase
            .from("products")
            .select("id, image_url, thumbnail, name")
            .is("image_embedding", null)
            .limit(EMBEDDING_BACKFILL_BATCH_SIZE)

        if (fetchError) {
            throw new Error(`Failed to fetch products: ${fetchError.message}`)
        }

        if (!products || products.length === 0) {
            return NextResponse.json({
                message: "All products processed",
                count: 0,
                remaining: false,
            })
        }

        const results: Array<{ id: string; status: string; error?: string }> = []

        for (const product of products) {
            try {
                const targetUrl = product.image_url || product.thumbnail

                if (!targetUrl) {
                    results.push({ id: product.id, status: "skipped" })
                    continue
                }

                const embedding = await generateImageEmbedding(targetUrl)

                const { error: updateError } = await supabase
                    .from("products")
                    .update({ image_embedding: embedding })
                    .eq("id", product.id)

                if (updateError) {
                    throw new Error(updateError.message)
                }

                results.push({ id: product.id, status: "success" })
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err)
                console.error(`Failed to process visual search embedding for ${product.id}:`, errorMessage)
                results.push({
                    id: product.id,
                    status: "failed",
                    error: errorMessage,
                })
            }
        }

        const successCount = results.filter((r) => r.status === "success").length
        const failedCount = results.filter((r) => r.status === "failed").length

        return NextResponse.json({
            processed: results.length,
            success: successCount,
            failed: failedCount,
            details: results,
            remaining: products.length >= EMBEDDING_BACKFILL_BATCH_SIZE,
        })
    } catch (error) {
        console.error("Backfill error:", error)
        return NextResponse.json(
            {
                error: "Backfill failed",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}
