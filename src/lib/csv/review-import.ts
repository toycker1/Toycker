import { validateNoSupabaseStorageMediaUrl } from "@/lib/util/media-url"

export const REVIEW_IMPORT_COLUMNS = [
  "product_handle",
  "product_id",
  "rating",
  "title",
  "content",
  "reviewer_name",
  "is_anonymous",
  "review_date",
  "approval_status",
  "media_urls",
  "source_review_id",
] as const

export type ReviewImportColumn = (typeof REVIEW_IMPORT_COLUMNS)[number]

export type ReviewImportCsvRow = Record<ReviewImportColumn, string | undefined>

export type ReviewApprovalStatus = "approved" | "pending" | "rejected"

export type ReviewImportMediaType = "image" | "video" | "audio"

export type ValidReviewImportRow = {
  rowNumber: number
  productHandle: string | null
  productId: string | null
  rating: number
  title: string
  content: string
  reviewerName: string
  isAnonymous: boolean
  reviewDate: string | null
  approvalStatus: ReviewApprovalStatus
  media: {
    url: string
    fileType: ReviewImportMediaType
  }[]
  sourceReviewId: string | null
}

export type ReviewImportRowError = {
  rowNumber: number
  message: string
}

export type ReviewImportValidationResult =
  | {
      ok: true
      row: ValidReviewImportRow
    }
  | {
      ok: false
      error: ReviewImportRowError
    }

const TRUE_VALUES = new Set(["true", "yes", "1"])
const FALSE_VALUES = new Set(["false", "no", "0", ""])
const APPROVAL_STATUSES = new Set<ReviewApprovalStatus>([
  "approved",
  "pending",
  "rejected",
])

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "svg",
])
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v"])
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg"])

const valueOf = (row: ReviewImportCsvRow, key: ReviewImportColumn) =>
  (row[key] || "").trim()

export function validateReviewImportHeaders(
  fields: string[] | undefined
): string | null {
  if (!fields || fields.length === 0) {
    return "CSV header row is missing."
  }

  const expected = [...REVIEW_IMPORT_COLUMNS]
  const missing = expected.filter((column) => !fields.includes(column))
  const unknown = fields.filter(
    (field) => !expected.includes(field as ReviewImportColumn)
  )

  if (missing.length > 0) {
    return `Missing columns: ${missing.join(", ")}.`
  }

  if (unknown.length > 0) {
    return `Unexpected columns: ${unknown.join(", ")}.`
  }

  return null
}

export function parseReviewImportBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase()

  if (TRUE_VALUES.has(normalized)) {
    return true
  }

  if (FALSE_VALUES.has(normalized)) {
    return false
  }

  return null
}

export function isValidReviewImportDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

export function inferReviewImportMediaType(
  url: string
): ReviewImportMediaType | null {
  let pathname = ""

  try {
    pathname = new URL(url).pathname
  } catch {
    return null
  }

  const extension = pathname.split(".").pop()?.toLowerCase()
  if (!extension || extension === pathname.toLowerCase()) {
    return null
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image"
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video"
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    return "audio"
  }

  return null
}

type MediaValidationResult =
  | {
      media: ValidReviewImportRow["media"]
    }
  | {
      error: ReviewImportRowError
    }

function validateMediaUrls(
  value: string,
  rowNumber: number
): MediaValidationResult {
  const urls = value
    .split(";")
    .map((url) => url.trim())
    .filter(Boolean)

  const media: ValidReviewImportRow["media"] = []

  for (const url of urls) {
    let parsed: URL

    try {
      parsed = new URL(url)
    } catch {
      return {
        error: {
          rowNumber,
          message: `Invalid media URL: ${url}`,
        },
      }
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        error: {
          rowNumber,
          message: `Media URL must start with http or https: ${url}`,
        },
      }
    }

    try {
      validateNoSupabaseStorageMediaUrl(url, "Review media URL")
    } catch (error) {
      return {
        error: {
          rowNumber,
          message:
            error instanceof Error
              ? error.message
              : `Invalid media URL: ${url}`,
        },
      }
    }

    const fileType = inferReviewImportMediaType(url)
    if (!fileType) {
      return {
        error: {
          rowNumber,
          message: `Unsupported media file type: ${url}`,
        },
      }
    }

    media.push({ url, fileType })
  }

  return { media }
}

export function validateReviewImportRow(
  row: ReviewImportCsvRow,
  rowNumber: number
): ReviewImportValidationResult {
  const productHandle = valueOf(row, "product_handle")
  const productId = valueOf(row, "product_id")
  const ratingValue = valueOf(row, "rating")
  const title = valueOf(row, "title")
  const content = valueOf(row, "content")
  const reviewerName = valueOf(row, "reviewer_name")
  const anonymousValue = valueOf(row, "is_anonymous")
  const reviewDate = valueOf(row, "review_date")
  const approvalStatusValue = valueOf(row, "approval_status").toLowerCase()
  const mediaUrls = valueOf(row, "media_urls")
  const sourceReviewId = valueOf(row, "source_review_id")

  if (!productId && !productHandle) {
    return {
      ok: false,
      error: {
        rowNumber,
        message: "Either product_id or product_handle is required.",
      },
    }
  }

  const rating = Number(ratingValue)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return {
      ok: false,
      error: {
        rowNumber,
        message: "Rating must be an integer from 1 to 5.",
      },
    }
  }

  if (!title) {
    return {
      ok: false,
      error: {
        rowNumber,
        message: "Title cannot be blank.",
      },
    }
  }

  const isAnonymous = parseReviewImportBoolean(anonymousValue)
  if (isAnonymous === null) {
    return {
      ok: false,
      error: {
        rowNumber,
        message: "is_anonymous must be true/false, yes/no, or 1/0.",
      },
    }
  }

  if (!isAnonymous && !reviewerName) {
    return {
      ok: false,
      error: {
        rowNumber,
        message: "reviewer_name cannot be blank unless is_anonymous is true.",
      },
    }
  }

  if (reviewDate && !isValidReviewImportDate(reviewDate)) {
    return {
      ok: false,
      error: {
        rowNumber,
        message: "review_date must use YYYY-MM-DD format.",
      },
    }
  }

  const approvalStatus = approvalStatusValue || "approved"
  if (!APPROVAL_STATUSES.has(approvalStatus as ReviewApprovalStatus)) {
    return {
      ok: false,
      error: {
        rowNumber,
        message: "approval_status must be approved, pending, or rejected.",
      },
    }
  }

  const mediaResult = validateMediaUrls(mediaUrls, rowNumber)
  if ("error" in mediaResult) {
    return {
      ok: false,
      error: mediaResult.error,
    }
  }

  return {
    ok: true,
    row: {
      rowNumber,
      productHandle: productHandle || null,
      productId: productId || null,
      rating,
      title,
      content,
      reviewerName,
      isAnonymous,
      reviewDate: reviewDate || null,
      approvalStatus: approvalStatus as ReviewApprovalStatus,
      media: mediaResult.media,
      sourceReviewId: sourceReviewId || null,
    },
  }
}
