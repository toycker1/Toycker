import { beforeEach, describe, expect, it, vi } from "vitest"

const { getSignedUrlMock } = vi.hoisted(() => ({
  getSignedUrlMock: vi.fn(),
}))

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}))

vi.mock("@/lib/r2", () => ({
  r2Client: {},
}))

vi.mock("uuid", () => ({
  v4: () => "test-upload-id",
}))

import { getPresignedUploadUrl } from "@/lib/actions/storage"

type SignedUrlCall = [
  unknown,
  {
    input: {
      Bucket: string
      Key: string
      ContentType: string
    }
  },
  {
    expiresIn: number
  },
]

describe("getPresignedUploadUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLOUDFLARE_R2_BUCKET = "test-bucket"
    getSignedUrlMock.mockResolvedValue("https://signed.example/upload")
  })

  it.each([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ])("accepts %s for product uploads", async (fileType) => {
    const result = await getPresignedUploadUrl({
      fileType,
      folder: "products",
    })

    expect(result).toEqual({
      url: "https://signed.example/upload",
      key: `products/test-upload-id.${fileType.split("/")[1]}`,
    })
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1)

    const [, command, options] = getSignedUrlMock.mock.calls[0] as SignedUrlCall

    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: `products/test-upload-id.${fileType.split("/")[1]}`,
      ContentType: fileType,
    })
    expect(options).toEqual({ expiresIn: 3600 })
  })

  it("rejects unsupported product image types", async () => {
    const result = await getPresignedUploadUrl({
      fileType: "image/svg+xml",
      folder: "products",
    })

    expect(result).toEqual({
      error:
        "Invalid file type for products. Allowed: image/jpeg, image/png, image/webp, image/gif",
    })
    expect(getSignedUrlMock).not.toHaveBeenCalled()
  })
})
