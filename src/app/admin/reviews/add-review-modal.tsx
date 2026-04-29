"use client"

import type { FormEvent } from "react"
import { useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
    Image as ImageIcon,
    Plus,
    Search,
    Star,
    X,
} from "lucide-react"
import { ActionButton } from "@/modules/admin/components"
import Modal from "@/modules/common/components/modal"
import {
    createAdminReview,
    type AdminReviewProduct,
    type ReviewData,
} from "@/lib/actions/reviews"
import { cn } from "@/lib/util/cn"
import { useReviewForm } from "@/modules/reviews/hooks/use-review-form"
import {
    ReviewAnonymousToggle,
    ReviewMediaUploader,
    ReviewRatingPicker,
    ReviewTextarea,
    ReviewTextInput,
    ReviewVoiceRecorderPanel,
} from "@/modules/reviews/components/review-form-fields"
import { uploadReviewMedia } from "@/modules/reviews/utils/upload-review-media"

type SubmitStatus = "idle" | "submitting" | "success"

export default function AddReviewModal({
    products,
}: {
    products: AdminReviewProduct[]
}) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [productId, setProductId] = useState("")
    const [search, setSearch] = useState("")
    const [status, setStatus] = useState<SubmitStatus>("idle")
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const reviewForm = useReviewForm()

    const selectedProduct = products.find(
        (product) => product.id === productId
    )

    const filteredProducts = useMemo(() => {
        const query = search.trim().toLowerCase()

        if (!query) {
            return products
        }

        return products.filter((product) =>
            `${product.name} ${product.handle} ${product.status}`
                .toLowerCase()
                .includes(query)
        )
    }, [products, search])

    const resetForm = () => {
        setProductId("")
        setSearch("")
        setErrorMessage(null)
        setStatus("idle")
        reviewForm.reset()
    }

    const closeModal = () => {
        if (status === "submitting") {
            return
        }

        setIsOpen(false)
        resetForm()
    }

    const validateForm = () => {
        if (!productId) {
            return "Please select a product."
        }

        return reviewForm.validate()
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setErrorMessage(null)

        const validationError = validateForm()
        if (validationError) {
            setErrorMessage(validationError)
            return
        }

        setStatus("submitting")

        try {
            const uploadedMedia: ReviewData["media"] = await uploadReviewMedia({
                files: reviewForm.files,
                audioBlob: reviewForm.voiceRecorder.audioBlob,
                voiceFilePrefix: "admin-voice-review",
            })

            const result = await createAdminReview({
                product_id: productId,
                rating: reviewForm.values.rating,
                title: reviewForm.values.title,
                content: reviewForm.values.content,
                display_name: reviewForm.values.displayName,
                is_anonymous: reviewForm.values.isAnonymous,
                media: uploadedMedia,
            })

            if (result?.error) {
                throw new Error(result.error)
            }

            setStatus("success")
            router.refresh()
            window.setTimeout(() => {
                setIsOpen(false)
                resetForm()
            }, 900)
        } catch (error) {
            setStatus("idle")
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to create review. Please try again."
            )
        }
    }

    return (
        <>
            <ActionButton
                type="button"
                onClick={() => setIsOpen(true)}
                icon={<Plus className="h-4 w-4" />}
            >
                Add Review
            </ActionButton>

            <Modal
                isOpen={isOpen}
                close={closeModal}
                size="xlarge"
                panelPadding="none"
                overflowHidden
            >
                <div className="flex max-h-[90vh] flex-col">
                    <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">
                                Add Product Review
                            </h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Create an approved review for any product.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={closeModal}
                            className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {status === "success" ? (
                        <ReviewPublished />
                    ) : (
                        <form
                            onSubmit={handleSubmit}
                            className="flex min-h-0 flex-1 flex-col"
                        >
                            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                                    <div className="space-y-6">
                                        <ProductPicker
                                            products={filteredProducts}
                                            selectedProduct={selectedProduct}
                                            search={search}
                                            onSearchChange={setSearch}
                                            onSelect={setProductId}
                                        />

                                        <ReviewRatingPicker
                                            value={reviewForm.values.rating}
                                            onChange={(rating) =>
                                                reviewForm.updateField("rating", rating)
                                            }
                                            variant="admin"
                                        />

                                        <ReviewTextInput
                                            label="Review Title"
                                            required
                                            value={reviewForm.values.title}
                                            placeholder="Summarize the experience"
                                            onChange={(value) =>
                                                reviewForm.updateField("title", value)
                                            }
                                            variant="admin"
                                        />

                                        <ReviewTextarea
                                            label="Detailed Review"
                                            value={reviewForm.values.content}
                                            placeholder="What should shoppers know about this product?"
                                            onChange={(value) =>
                                                reviewForm.updateField("content", value)
                                            }
                                            variant="admin"
                                        />

                                        <ReviewTextInput
                                            label="Display Name"
                                            required={!reviewForm.values.isAnonymous}
                                            value={reviewForm.values.displayName}
                                            placeholder="How the reviewer appears publicly"
                                            onChange={(value) =>
                                                reviewForm.updateField("displayName", value)
                                            }
                                            variant="admin"
                                        />

                                        <ReviewAnonymousToggle
                                            checked={reviewForm.values.isAnonymous}
                                            onChange={(checked) =>
                                                reviewForm.updateField("isAnonymous", checked)
                                            }
                                            variant="admin"
                                        />
                                    </div>

                                    <div className="space-y-6">
                                        <ReviewMediaUploader
                                            files={reviewForm.files}
                                            inputResetKey={reviewForm.mediaInputResetKey}
                                            onFileChange={reviewForm.handleFileChange}
                                            onRemoveFile={reviewForm.removeFile}
                                            variant="admin"
                                        />
                                        <ReviewVoiceRecorderPanel
                                            voiceRecorder={reviewForm.voiceRecorder}
                                            variant="admin"
                                        />
                                    </div>
                                </div>
                            </div>

                            {errorMessage && (
                                <div className="border-t border-red-100 bg-red-50 px-6 py-3 text-sm font-medium text-red-700">
                                    {errorMessage}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
                                <ActionButton
                                    type="button"
                                    variant="secondary"
                                    onClick={closeModal}
                                    disabled={status === "submitting"}
                                >
                                    Discard
                                </ActionButton>
                                <ActionButton
                                    type="submit"
                                    isLoading={status === "submitting"}
                                    loadingText="Publishing..."
                                >
                                    Publish Review
                                </ActionButton>
                            </div>
                        </form>
                    )}
                </div>
            </Modal>
        </>
    )
}

function ReviewPublished() {
    return (
        <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
                <Star className="h-7 w-7 fill-current" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
                Review published
            </h3>
            <p className="mt-2 text-sm text-gray-500">
                The review is now visible on the product detail page.
            </p>
        </div>
    )
}

function ProductPicker({
    products,
    selectedProduct,
    search,
    onSearchChange,
    onSelect,
}: {
    products: AdminReviewProduct[]
    selectedProduct?: AdminReviewProduct
    search: string
    onSearchChange: (_value: string) => void
    onSelect: (_productId: string) => void
}) {
    return (
        <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-700">
                Product <span className="text-red-500">*</span>
            </label>
            {selectedProduct && (
                <div className="flex items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                    <ProductImage product={selectedProduct} />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                            {selectedProduct.name}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                            {selectedProduct.handle}
                        </p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        {selectedProduct.status}
                    </span>
                </div>
            )}
            <div className="rounded-lg border border-gray-200 bg-white">
                <div className="relative border-b border-gray-100">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search products..."
                        className="w-full rounded-t-lg border-0 py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                    />
                </div>
                <div className="max-h-56 overflow-y-auto">
                    {products.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-500">
                            No products found.
                        </div>
                    ) : (
                        products.map((product) => (
                            <button
                                key={product.id}
                                type="button"
                                onClick={() => onSelect(product.id)}
                                className={cn(
                                    "flex w-full items-center gap-3 border-b border-gray-100 px-3 py-3 text-left transition last:border-b-0 hover:bg-gray-50",
                                    selectedProduct?.id === product.id && "bg-gray-50"
                                )}
                            >
                                <ProductImage product={product} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-900">
                                        {product.name}
                                    </p>
                                    <p className="truncate text-xs text-gray-500">
                                        {product.handle}
                                    </p>
                                </div>
                                <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                    {product.status}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

function ProductImage({ product }: { product: AdminReviewProduct }) {
    const imageUrl = product.image_url || product.thumbnail

    return (
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {imageUrl ? (
                <Image
                    src={imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="44px"
                    unoptimized
                />
            ) : (
                <ImageIcon className="h-5 w-5 text-gray-400" />
            )}
        </div>
    )
}
