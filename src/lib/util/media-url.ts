const DEFAULT_MEDIA_HOSTNAME = "cdn.toycker.in"

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")

const trimLeadingSlash = (value: string) => value.replace(/^\/+/, "")

export const getPublicMediaBaseUrl = () => {
  const configuredPublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim()

  if (configuredPublicUrl) {
    return trimTrailingSlash(configuredPublicUrl)
  }

  const protocol = process.env.NEXT_PUBLIC_R2_MEDIA_PROTOCOL?.trim() || "https"
  const hostname =
    process.env.NEXT_PUBLIC_R2_MEDIA_HOSTNAME?.trim() || DEFAULT_MEDIA_HOSTNAME

  return `${protocol}://${hostname}`
}

export const isSupabaseStorageUrl = (url: string) => {
  const normalized = url.trim().toLowerCase()

  return (
    normalized.includes(".supabase.co/storage/") ||
    normalized.includes(".supabase.co/storage/v1/object") ||
    normalized.includes("/storage/v1/object/")
  )
}

export const buildPublicMediaUrl = (keyOrUrl: string | null | undefined) => {
  if (!keyOrUrl) {
    return ""
  }

  const value = keyOrUrl.trim()
  if (!value) {
    return ""
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    let url: URL

    try {
      url = new URL(value)
    } catch {
      return value
    }

    if (url.hostname.endsWith(".r2.dev")) {
      return `${getPublicMediaBaseUrl()}/${trimLeadingSlash(url.pathname)}`
    }

    return value
  }

  return `${getPublicMediaBaseUrl()}/${trimLeadingSlash(value)}`
}

export const validateNoSupabaseStorageMediaUrl = (
  url: string | null | undefined,
  fieldLabel: string
) => {
  if (!url) {
    return
  }

  if (isSupabaseStorageUrl(url)) {
    throw new Error(
      `${fieldLabel} must use Cloudflare CDN/R2 media, not Supabase Storage.`
    )
  }
}

export const validateMediaUrlList = (
  urls: string[],
  fieldLabel: string
) => {
  urls.forEach((url) => validateNoSupabaseStorageMediaUrl(url, fieldLabel))
}
