"use client"

import { getPresignedUploadUrl } from "@/lib/actions/storage"
import type { ReviewData } from "@/lib/actions/reviews"
import type { ReviewFileType } from "../types"

export function getReviewFileType(file: File): ReviewFileType {
  if (file.type.startsWith("image/")) {
    return "image"
  }

  if (file.type.startsWith("video/")) {
    return "video"
  }

  return "audio"
}

export function createVoiceReviewFile(audioBlob: Blob, prefix: string) {
  const extension = audioBlob.type.includes("mp4") ? "mp4" : "webm"

  return new File([audioBlob], `${prefix}-${Date.now()}.${extension}`, {
    type: audioBlob.type,
  })
}

export async function uploadWithRetry(
  url: string,
  file: File,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })

      if (response.ok || (response.status < 500 && response.status !== 429)) {
        return response
      }

      throw new Error(`Upload failed with status ${response.status}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
      }
    }
  }

  throw lastError ?? new Error("Upload failed after retries.")
}

export async function uploadReviewMedia({
  files,
  audioBlob,
  voiceFilePrefix,
}: {
  files: File[]
  audioBlob: Blob | null
  voiceFilePrefix: string
}): Promise<ReviewData["media"]> {
  const uploadFiles = [...files]

  if (audioBlob) {
    uploadFiles.push(createVoiceReviewFile(audioBlob, voiceFilePrefix))
  }

  const uploadedMedia: ReviewData["media"] = []

  for (const file of uploadFiles) {
    const { url, key, error } = await getPresignedUploadUrl({
      fileType: file.type,
    })

    if (error || !url || !key) {
      throw new Error(error || "Failed to initialize upload.")
    }

    const uploadResponse = await uploadWithRetry(url, file)

    if (!uploadResponse.ok) {
      throw new Error(
        `Failed to upload file. Server returned ${uploadResponse.status}.`
      )
    }

    uploadedMedia.push({
      file_path: key,
      file_type: getReviewFileType(file),
    })
  }

  return uploadedMedia
}
