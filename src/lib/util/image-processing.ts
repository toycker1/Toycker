/**
 * Resizes an image to a maximum dimension and converts it to a JPEG blob.
 * This helps stay within payload limits and ensures format compatibility.
 */
export async function resizeImage(
    file: File,
    maxDimension = 512,
    quality = 0.85
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement("canvas")
                let width = img.width
                let height = img.height

                if (width > height) {
                    if (width > maxDimension) {
                        height *= maxDimension / width
                        width = maxDimension
                    }
                } else {
                    if (height > maxDimension) {
                        width *= maxDimension / height
                        height = maxDimension
                    }
                }

                canvas.width = width
                canvas.height = height

                const ctx = canvas.getContext("2d")
                if (!ctx) {
                    reject(new Error("Could not get canvas context"))
                    return
                }

                ctx.drawImage(img, 0, 0, width, height)

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob)
                        } else {
                            reject(new Error("Canvas toBlob failed"))
                        }
                    },
                    "image/jpeg",
                    quality
                )
            }
            img.onerror = () => reject(new Error("Failed to load image into element"))
            img.src = e.target?.result as string
        }
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsDataURL(file)
    })
}

type ImageCropArea = {
    x: number
    y: number
    width: number
    height: number
}

export async function resizeImageCropFromElement(
    image: HTMLImageElement,
    crop: ImageCropArea,
    maxDimension = 512,
    quality = 0.82
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const sourceX = Math.max(0, Math.min(Math.round(crop.x), image.naturalWidth - 1))
        const sourceY = Math.max(0, Math.min(Math.round(crop.y), image.naturalHeight - 1))
        const sourceWidth = Math.max(1, Math.min(Math.round(crop.width), image.naturalWidth - sourceX))
        const sourceHeight = Math.max(1, Math.min(Math.round(crop.height), image.naturalHeight - sourceY))
        const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight))
        const outputWidth = Math.max(1, Math.round(sourceWidth * scale))
        const outputHeight = Math.max(1, Math.round(sourceHeight * scale))
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")

        if (!ctx) {
            reject(new Error("Could not get canvas context"))
            return
        }

        canvas.width = outputWidth
        canvas.height = outputHeight
        ctx.drawImage(
            image,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            outputWidth,
            outputHeight
        )

        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob)
                } else {
                    reject(new Error("Canvas toBlob failed"))
                }
            },
            "image/jpeg",
            quality
        )
    })
}
