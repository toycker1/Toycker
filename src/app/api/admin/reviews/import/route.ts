import { NextRequest, NextResponse } from "next/server"
import Papa from "papaparse"
import { revalidatePath } from "next/cache"

import { PERMISSIONS } from "@/lib/permissions"
import { checkPermission } from "@/lib/permissions/server"
import { createClient } from "@/lib/supabase/server"
import {
  type ReviewImportCsvRow,
  type ReviewImportRowError,
  type ValidReviewImportRow,
  validateReviewImportHeaders,
  validateReviewImportRow,
} from "@/lib/csv/review-import"

export const maxDuration = 300

const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024
const MAX_IMPORT_ROWS = 1000
const INSERT_BATCH_SIZE = 100

type ProductLookup = {
  id: string
  handle: string
}

type ResolvedReviewImportRow = {
  row: ValidReviewImportRow
  product: ProductLookup
}

type ReviewInsert = {
  id: string
  product_id: string
  user_id: string
  rating: number
  title: string
  content: string
  display_name: string
  is_anonymous: boolean
  approval_status: "approved" | "pending" | "rejected"
  source_review_id: string | null
  created_at?: string
}

type ReviewMediaInsert = {
  review_id: string
  file_path: string
  file_type: "image" | "video" | "audio"
  storage_provider: "external"
}

type ExistingSourceReview = {
  product_id: string
  source_review_id: string | null
}

type ImportSkippedRow = {
  rowNumber: number
  message: string
}

type ImportResponse = {
  success: boolean
  imported: number
  skipped: number
  failed: number
  mediaImported: number
  errors: ReviewImportRowError[]
  skippedRows: ImportSkippedRow[]
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isCsvFile(file: File): boolean {
  const lowerName = file.name.toLowerCase()
  return (
    lowerName.endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel"
  )
}

function sourceKey(productId: string, sourceReviewId: string) {
  return `${productId}:${sourceReviewId}`
}

function toReviewInsert(
  row: ValidReviewImportRow,
  productId: string,
  userId: string
): ReviewInsert {
  const reviewInsert: ReviewInsert = {
    id: crypto.randomUUID(),
    product_id: productId,
    user_id: userId,
    rating: row.rating,
    title: row.title,
    content: row.content,
    display_name: row.isAnonymous ? "" : row.reviewerName,
    is_anonymous: row.isAnonymous,
    approval_status: row.approvalStatus,
    source_review_id: row.sourceReviewId,
  }

  if (row.reviewDate) {
    reviewInsert.created_at = `${row.reviewDate}T00:00:00.000Z`
  }

  return reviewInsert
}

async function insertInBatches<T extends Record<string, unknown>>(
  tableName: "reviews" | "review_media",
  rows: T[],
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
    const batch = rows.slice(start, start + INSERT_BATCH_SIZE)
    const { error } = await supabase.from(tableName).insert(batch)

    if (error) {
      throw new Error(error.message)
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canImportReviews = await checkPermission(PERMISSIONS.REVIEWS_UPDATE)
    if (!canImportReviews) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const uploadedFile = formData.get("file")

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!isCsvFile(uploadedFile)) {
      return NextResponse.json(
        { error: "Only CSV files are supported" },
        { status: 400 }
      )
    }

    if (uploadedFile.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: "CSV file is too large",
          details: "Maximum allowed file size is 5MB.",
        },
        { status: 400 }
      )
    }

    const csvText = await uploadedFile.text()
    const parseResult = Papa.parse<ReviewImportCsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
    })

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        {
          error: "Invalid CSV format",
          details: parseResult.errors[0]?.message || "Could not parse CSV.",
        },
        { status: 400 }
      )
    }

    const headerError = validateReviewImportHeaders(parseResult.meta.fields)
    if (headerError) {
      return NextResponse.json(
        {
          error: "Invalid CSV template",
          details: headerError,
        },
        { status: 400 }
      )
    }

    const rows = parseResult.data
    if (rows.length === 0) {
      return NextResponse.json({ error: "Empty CSV" }, { status: 400 })
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        {
          error: "CSV has too many rows",
          details: `Maximum allowed rows per import is ${MAX_IMPORT_ROWS}.`,
        },
        { status: 400 }
      )
    }

    const rowErrors: ReviewImportRowError[] = []
    const validRows: ValidReviewImportRow[] = []

    rows.forEach((row, index) => {
      const validation = validateReviewImportRow(row, index + 2)
      if (validation.ok) {
        validRows.push(validation.row)
      } else {
        rowErrors.push(validation.error)
      }
    })

    const productIds = Array.from(
      new Set(validRows.map((row) => row.productId).filter((id): id is string => Boolean(id)))
    )
    const productHandles = Array.from(
      new Set(
        validRows
          .filter((row) => !row.productId)
          .map((row) => row.productHandle)
          .filter((handle): handle is string => Boolean(handle))
      )
    )

    const productsById = new Map<string, ProductLookup>()
    const productsByHandle = new Map<string, ProductLookup>()

    if (productIds.length > 0) {
      const { data, error } = await supabase
        .from("products")
        .select("id, handle")
        .in("id", productIds)

      if (error) {
        throw new Error(`Failed to match products by ID: ${error.message}`)
      }

      for (const product of (data || []) as ProductLookup[]) {
        productsById.set(product.id, product)
      }
    }

    if (productHandles.length > 0) {
      const { data, error } = await supabase
        .from("products")
        .select("id, handle")
        .in("handle", productHandles)

      if (error) {
        throw new Error(`Failed to match products by handle: ${error.message}`)
      }

      for (const product of (data || []) as ProductLookup[]) {
        productsByHandle.set(product.handle, product)
      }
    }

    const resolvedRows: ResolvedReviewImportRow[] = []

    for (const row of validRows) {
      const product = row.productId
        ? productsById.get(row.productId)
        : row.productHandle
          ? productsByHandle.get(row.productHandle)
          : undefined

      if (!product) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          message: "Product not found.",
        })
        continue
      }

      resolvedRows.push({ row, product })
    }

    const sourceRows = resolvedRows.filter(
      ({ row }) => row.sourceReviewId !== null
    )
    const existingDuplicateKeys = new Set<string>()

    if (sourceRows.length > 0) {
      const duplicateProductIds = Array.from(
        new Set(sourceRows.map(({ product }) => product.id))
      )
      const duplicateSourceIds = Array.from(
        new Set(
          sourceRows
            .map(({ row }) => row.sourceReviewId)
            .filter((id): id is string => Boolean(id))
        )
      )

      const { data, error } = await supabase
        .from("reviews")
        .select("product_id, source_review_id")
        .in("product_id", duplicateProductIds)
        .in("source_review_id", duplicateSourceIds)

      if (error) {
        throw new Error(`Failed to check duplicate reviews: ${error.message}`)
      }

      for (const review of (data || []) as ExistingSourceReview[]) {
        if (review.source_review_id) {
          existingDuplicateKeys.add(
            sourceKey(review.product_id, review.source_review_id)
          )
        }
      }
    }

    const importDuplicateKeys = new Set<string>()
    const skippedRows: ImportSkippedRow[] = []
    const reviewInserts: ReviewInsert[] = []
    const mediaInserts: ReviewMediaInsert[] = []
    const affectedProductHandles = new Set<string>()

    for (const { row, product } of resolvedRows) {
      if (row.sourceReviewId) {
        const key = sourceKey(product.id, row.sourceReviewId)
        if (existingDuplicateKeys.has(key)) {
          skippedRows.push({
            rowNumber: row.rowNumber,
            message: "Skipped duplicate source_review_id for this product.",
          })
          continue
        }

        if (importDuplicateKeys.has(key)) {
          skippedRows.push({
            rowNumber: row.rowNumber,
            message: "Skipped duplicate source_review_id inside this CSV.",
          })
          continue
        }

        importDuplicateKeys.add(key)
      }

      const reviewInsert = toReviewInsert(row, product.id, user.id)
      reviewInserts.push(reviewInsert)
      affectedProductHandles.add(product.handle)

      for (const media of row.media) {
        mediaInserts.push({
          review_id: reviewInsert.id,
          file_path: media.url,
          file_type: media.fileType,
          storage_provider: "external",
        })
      }
    }

    if (reviewInserts.length > 0) {
      await insertInBatches("reviews", reviewInserts, supabase)
    }

    if (mediaInserts.length > 0) {
      await insertInBatches("review_media", mediaInserts, supabase)
    }

    revalidatePath("/admin/reviews")
    for (const handle of Array.from(affectedProductHandles)) {
      revalidatePath(`/products/${handle}`)
    }

    const response: ImportResponse = {
      success: true,
      imported: reviewInserts.length,
      skipped: skippedRows.length,
      failed: rowErrors.length,
      mediaImported: mediaInserts.length,
      errors: rowErrors,
      skippedRows,
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = getErrorMessage(error)
    console.error("Review CSV import error:", message)
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    )
  }
}
