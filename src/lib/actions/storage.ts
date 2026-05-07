"use server"

import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { r2Client } from "../r2"
import { v4 as uuidv4 } from "uuid"
import {
    MEDIA_UPLOAD_CACHE_CONTROL,
    UPLOAD_ALLOWED_FILE_TYPES,
    UPLOAD_MAX_FILE_SIZE_MB,
    getUploadMaxFileSizeBytes,
    isAllowedUploadFileType,
    type UploadFolder,
} from "@/lib/constants/upload-file-types"
import { getPublicMediaBaseUrl } from "@/lib/util/media-url"

export async function getPresignedUploadUrl({
    fileType,
    folder = "reviews",
    fileSizeBytes,
}: {
    fileType: string
    folder?: UploadFolder
    fileSizeBytes?: number
}) {
    try {
        const allowedTypes = UPLOAD_ALLOWED_FILE_TYPES[folder]

        if (!isAllowedUploadFileType(folder, fileType)) {
            return { error: `Invalid file type for ${folder}. Allowed: ${allowedTypes.join(", ")}` }
        }

        if (
            typeof fileSizeBytes === "number" &&
            fileSizeBytes > getUploadMaxFileSizeBytes(folder)
        ) {
            return { error: `File must be ${UPLOAD_MAX_FILE_SIZE_MB[folder]}MB or smaller.` }
        }

        const fileId = uuidv4()
        // Extract extension from mime type (handle parameters like codecs)
        const pureMimeType = fileType.split(";")[0]
        const extension = pureMimeType.split("/")[1] || "bin"
        const key = `${folder}/${fileId}.${extension}`

        const command = new PutObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
            Key: key,
            ContentType: fileType,
            CacheControl: MEDIA_UPLOAD_CACHE_CONTROL,
        })

        const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 })

        return { url: signedUrl, key, cacheControl: MEDIA_UPLOAD_CACHE_CONTROL }
    } catch (error) {
        console.error("Error generating presigned URL:", error)
        return { error: "Unable to prepare file upload. Please try again." }
    }
}

export async function deleteFile(key: string) {
    try {
        const command = new DeleteObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
            Key: key,
        })

        await r2Client.send(command)
        return { success: true }
    } catch (error) {
        console.error("Error deleting file from R2:", error)
        return { error: "Failed to delete file from storage" }
    }
}

/**
 * Extracts the R2 key from a full public URL.
 * Example: https://pub-xxx.r2.dev/banners/file.jpg -> banners/file.jpg
 */
export async function extractKeyFromUrl(url: string): Promise<string | null> {
    try {
        const publicUrl = getPublicMediaBaseUrl()
        if (!url.startsWith(publicUrl)) {
            return null
        }

        // Remove the base URL and the leading slash
        // url: https://cdn.example.com/folder/file.jpg
        // publicUrl: https://cdn.example.com
        // result: folder/file.jpg
        const key = url.replace(publicUrl, "").replace(/^\//, "")
        return key
    } catch (e) {
        return null
    }
}
