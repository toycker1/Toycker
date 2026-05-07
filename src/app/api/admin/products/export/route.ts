import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { CsvProductRow } from "@/lib/types/import"
import Papa from "papaparse"

const CSV_COLUMNS = [
    "Handle",
    "Title",
    "Description",
    "Short Description",
    "Subtitle",
    "Status",
    "Product Type",
    "Thumbnail URL",
    "Image URLs",
    "Video URL",
    "Category Handles",
    "Collection Handles",
    "Currency",
    "SKU",
    "Price",
    "Compare At Price",
    "Stock",
    "Barcode",
    "Option 1 Name",
    "Option 1 Value",
    "Option 2 Name",
    "Option 2 Value",
    "Option 3 Name",
    "Option 3 Value",
] as const

const OPTION_NAME_COLUMNS = [
    "Option 1 Name",
    "Option 2 Name",
    "Option 3 Name",
] as const

const OPTION_VALUE_COLUMNS = [
    "Option 1 Value",
    "Option 2 Value",
    "Option 3 Value",
] as const

type ProductStatus = "active" | "draft" | "archived"

type ProductExportVariantOption = {
    name?: string | null
    title?: string | null
    value?: string | null
}

type ProductExportVariant = {
    title: string | null
    sku: string | null
    barcode: string | null
    price: number | null
    compare_at_price: number | null
    inventory_quantity: number | null
    options: unknown
}

type ProductExportRelation<T extends string> = {
    [K in T]?:
    | {
        handle: string | null
    }
    | Array<{
        handle: string | null
    }>
    | null
}

type ProductExportRow = {
    handle: string
    name: string
    description: string | null
    short_description: string | null
    subtitle: string | null
    status: ProductStatus
    thumbnail: string | null
    image_url: string | null
    images: string[] | null
    video_url: string | null
    currency_code: string | null
    price: number | null
    stock_count: number | null
    metadata: Record<string, unknown> | null
    variants: ProductExportVariant[] | null
    collections: ProductExportRelation<"collection">[] | null
    categories: ProductExportRelation<"category">[] | null
}

function getCompareAtPrice(metadata: Record<string, unknown> | null): number | string {
    const value = metadata?.compare_at_price

    if (typeof value === "number" || typeof value === "string") {
        return value
    }

    return ""
}

function getRelationHandles<T extends string>(
    relations: ProductExportRelation<T>[] | null,
    key: T
): string {
    return (
        relations
            ?.map((relation) => {
                const value = relation[key]
                return Array.isArray(value) ? value[0]?.handle : value?.handle
            })
            .filter((handle): handle is string => Boolean(handle))
            .join(";") || ""
    )
}

function getVariantOptions(options: unknown): ProductExportVariantOption[] {
    if (!Array.isArray(options)) {
        return []
    }

    return options.filter((option): option is ProductExportVariantOption => {
        if (!option || typeof option !== "object") {
            return false
        }

        const candidate = option as ProductExportVariantOption
        return Boolean(candidate.name || candidate.title || candidate.value)
    })
}

function applyVariantOptions(row: CsvProductRow, productName: string, variant: ProductExportVariant) {
    const rawOptions = getVariantOptions(variant.options)

    if (rawOptions.length > 0) {
        rawOptions.slice(0, 3).forEach((option, index) => {
            row[OPTION_NAME_COLUMNS[index]] = option.name || option.title || `Option ${index + 1}`
            row[OPTION_VALUE_COLUMNS[index]] = option.value || ""
        })
        return
    }

    if (!variant.title || variant.title === productName || variant.title.toLowerCase() === "default") {
        return
    }

    variant.title
        .split(" / ")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 3)
        .forEach((value, index) => {
            row[OPTION_NAME_COLUMNS[index]] = `Option ${index + 1}`
            row[OPTION_VALUE_COLUMNS[index]] = value
        })
}

export async function GET(_request: NextRequest) {
    try {
        const supabase = await createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single()
        if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

        const { data: products, error } = await supabase
            .from("products")
            .select(
                `
                handle,
                name,
                description,
                short_description,
                subtitle,
                status,
                thumbnail,
                image_url,
                images,
                video_url,
                currency_code,
                price,
                stock_count,
                metadata,
                variants:product_variants(
                    title,
                    sku,
                    barcode,
                    price,
                    compare_at_price,
                    inventory_quantity,
                    options
                ),
                collections:product_collections(collection:collections(handle)),
                categories:product_categories(category:categories(handle))
            `
            )
            .neq("id", "00000000-0000-0000-0000-000000000000")

        if (error) throw error

        const csvRows: CsvProductRow[] = []

        for (const product of (products || []) as unknown as ProductExportRow[]) {
            const baseRow: Partial<CsvProductRow> = {
                Handle: product.handle,
                Title: product.name,
                Description: product.description || "",
                "Short Description": product.short_description || "",
                Subtitle: product.subtitle || "",
                Status: product.status,
                "Product Type": product.variants && product.variants.length > 0 ? "variable" : "single",
                "Thumbnail URL": product.thumbnail || product.image_url || "",
                "Image URLs": (product.images || []).join(";"),
                "Video URL": product.video_url || "",
                "Category Handles": getRelationHandles(product.categories, "category"),
                "Collection Handles": getRelationHandles(product.collections, "collection"),
                Currency: product.currency_code || "INR",
            }

            const variants = product.variants || []

            if (variants.length === 0) {
                csvRows.push({
                    ...baseRow,
                    SKU: "",
                    Price: product.price || 0,
                    "Compare At Price": getCompareAtPrice(product.metadata),
                    Stock: product.stock_count || 0,
                    Barcode: "",
                } as CsvProductRow)
                continue
            }

            for (const variant of variants) {
                const variantRow: CsvProductRow = {
                    ...baseRow,
                    SKU: variant.sku || "",
                    Price: variant.price || 0,
                    "Compare At Price": variant.compare_at_price || "",
                    Stock: variant.inventory_quantity || 0,
                    Barcode: variant.barcode || "",
                } as CsvProductRow

                applyVariantOptions(variantRow, product.name, variant)
                csvRows.push(variantRow)
            }
        }

        const csv = Papa.unparse({
            fields: [...CSV_COLUMNS],
            data: csvRows,
        })

        return new NextResponse(csv, {
            status: 200,
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="toycker-products-${new Date().toISOString().split("T")[0]}.csv"`,
            },
        })
    } catch (error) {
        console.error("Export error:", error)
        return NextResponse.json({ error: "Export failed" }, { status: 500 })
    }
}
