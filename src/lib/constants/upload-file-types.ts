export const PRODUCT_MEDIA_MAX_FILE_SIZE_MB = 5
export const PRODUCT_MEDIA_MAX_FILE_SIZE_BYTES =
  PRODUCT_MEDIA_MAX_FILE_SIZE_MB * 1024 * 1024

export const PRODUCT_MEDIA_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const

export type ProductMediaImageType = (typeof PRODUCT_MEDIA_IMAGE_TYPES)[number]

export const PRODUCT_MEDIA_ACCEPT_VALUE = PRODUCT_MEDIA_IMAGE_TYPES.join(",")
export const PRODUCT_MEDIA_ALLOWED_TYPES_LABEL = "JPG, PNG, WebP, GIF"

const REVIEW_UPLOAD_FILE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/webm;codecs=opus",
]

const STANDARD_IMAGE_UPLOAD_FILE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
]

const EXCLUSIVE_VIDEO_UPLOAD_FILE_TYPES: readonly string[] = [
  "video/mp4",
  "video/webm",
]

export const UPLOAD_ALLOWED_FILE_TYPES = {
  reviews: REVIEW_UPLOAD_FILE_TYPES,
  banners: STANDARD_IMAGE_UPLOAD_FILE_TYPES,
  "exclusive-videos": EXCLUSIVE_VIDEO_UPLOAD_FILE_TYPES,
  products: PRODUCT_MEDIA_IMAGE_TYPES,
  categories: STANDARD_IMAGE_UPLOAD_FILE_TYPES,
  collections: STANDARD_IMAGE_UPLOAD_FILE_TYPES,
} as const

export type UploadFolder = keyof typeof UPLOAD_ALLOWED_FILE_TYPES

export const isAllowedUploadFileType = (
  folder: UploadFolder,
  fileType: string
) => {
  const allowedFileTypes = UPLOAD_ALLOWED_FILE_TYPES[folder] as readonly string[]
  return allowedFileTypes.includes(fileType)
}

export const isProductMediaImageType = (
  fileType: string
): fileType is ProductMediaImageType => {
  const allowedFileTypes = PRODUCT_MEDIA_IMAGE_TYPES as readonly string[]
  return allowedFileTypes.includes(fileType)
}
