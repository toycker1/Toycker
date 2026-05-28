import { describe, expect, it } from "vitest"

import {
  inferReviewImportMediaType,
  parseReviewImportBoolean,
  validateReviewImportHeaders,
  validateReviewImportRow,
  type ReviewImportCsvRow,
} from "@/lib/csv/review-import"

const baseRow = (overrides: Partial<ReviewImportCsvRow> = {}): ReviewImportCsvRow => ({
  product_handle: "wooden-learning-bus",
  product_id: "",
  rating: "5",
  title: "Excellent toy",
  content: "Good quality.",
  reviewer_name: "Priya",
  is_anonymous: "false",
  review_date: "2026-05-28",
  approval_status: "approved",
  media_urls: "",
  source_review_id: "source-1",
  ...overrides,
})

describe("review CSV import validation", () => {
  it("accepts a valid row matched by product handle", () => {
    const result = validateReviewImportRow(baseRow(), 2)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.row.productHandle).toBe("wooden-learning-bus")
      expect(result.row.productId).toBeNull()
      expect(result.row.rating).toBe(5)
      expect(result.row.approvalStatus).toBe("approved")
    }
  })

  it("prefers product ID when product handle is also present", () => {
    const result = validateReviewImportRow(
      baseRow({ product_id: "product-123" }),
      2
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.row.productId).toBe("product-123")
      expect(result.row.productHandle).toBe("wooden-learning-bus")
    }
  })

  it("rejects invalid ratings", () => {
    const result = validateReviewImportRow(baseRow({ rating: "6" }), 4)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toEqual({
        rowNumber: 4,
        message: "Rating must be an integer from 1 to 5.",
      })
    }
  })

  it("rejects invalid review dates", () => {
    const result = validateReviewImportRow(
      baseRow({ review_date: "28-05-2026" }),
      3
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe("review_date must use YYYY-MM-DD format.")
    }
  })

  it("requires reviewer name unless the row is anonymous", () => {
    const namedResult = validateReviewImportRow(
      baseRow({ reviewer_name: "", is_anonymous: "no" }),
      2
    )
    const anonymousResult = validateReviewImportRow(
      baseRow({ reviewer_name: "", is_anonymous: "yes" }),
      3
    )

    expect(namedResult.ok).toBe(false)
    expect(anonymousResult.ok).toBe(true)
  })

  it("defaults blank approval status to approved and rejects unknown statuses", () => {
    const defaultResult = validateReviewImportRow(
      baseRow({ approval_status: "" }),
      2
    )
    const invalidResult = validateReviewImportRow(
      baseRow({ approval_status: "hidden" }),
      3
    )

    expect(defaultResult.ok).toBe(true)
    if (defaultResult.ok) {
      expect(defaultResult.row.approvalStatus).toBe("approved")
    }
    expect(invalidResult.ok).toBe(false)
  })

  it("accepts public media URLs and infers media types", () => {
    const result = validateReviewImportRow(
      baseRow({
        media_urls:
          "https://cdn.example.com/review.jpg;https://cdn.example.com/review.mp4;https://cdn.example.com/review.mp3",
      }),
      2
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.row.media).toEqual([
        { url: "https://cdn.example.com/review.jpg", fileType: "image" },
        { url: "https://cdn.example.com/review.mp4", fileType: "video" },
        { url: "https://cdn.example.com/review.mp3", fileType: "audio" },
      ])
    }
  })

  it("rejects Supabase Storage media URLs", () => {
    const result = validateReviewImportRow(
      baseRow({
        media_urls:
          "https://example.supabase.co/storage/v1/object/public/reviews/photo.jpg",
      }),
      2
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toContain("Supabase Storage")
    }
  })

  it("validates expected headers exactly", () => {
    expect(
      validateReviewImportHeaders([
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
      ])
    ).toBeNull()

    expect(validateReviewImportHeaders(["product_handle", "rating"])).toContain(
      "Missing columns"
    )
    expect(
      validateReviewImportHeaders([
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
        "extra",
      ])
    ).toContain("Unexpected columns")
  })

  it("parses supported boolean values", () => {
    expect(parseReviewImportBoolean("true")).toBe(true)
    expect(parseReviewImportBoolean("yes")).toBe(true)
    expect(parseReviewImportBoolean("1")).toBe(true)
    expect(parseReviewImportBoolean("false")).toBe(false)
    expect(parseReviewImportBoolean("no")).toBe(false)
    expect(parseReviewImportBoolean("0")).toBe(false)
    expect(parseReviewImportBoolean("maybe")).toBeNull()
  })

  it("infers supported media file types from URL paths", () => {
    expect(inferReviewImportMediaType("https://cdn.example.com/a.webp")).toBe(
      "image"
    )
    expect(inferReviewImportMediaType("https://cdn.example.com/a.mov")).toBe(
      "video"
    )
    expect(inferReviewImportMediaType("https://cdn.example.com/a.m4a")).toBe(
      "audio"
    )
    expect(inferReviewImportMediaType("https://cdn.example.com/a.txt")).toBeNull()
  })
})
