import { S3Client } from "@aws-sdk/client-s3"
import { buildPublicMediaUrl } from "@/lib/util/media-url"

export const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
  },
})

export const getFileUrl = (key: string) => {
  return buildPublicMediaUrl(key)
}
