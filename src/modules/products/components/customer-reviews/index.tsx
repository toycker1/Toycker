"use client"

import { useState, useMemo, Fragment, useEffect } from "react"
import { Button } from "@modules/common/components/button"
import Modal from "@modules/common/components/modal"
import { Dialog, Transition } from "@headlessui/react"
import { CheckCircle2, ImageIcon, Mic, Play, ShieldCheck, Star, User, Video, X } from "lucide-react"
import { submitReview, type ReviewData, type ReviewWithMedia } from "@/lib/actions/reviews"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { cn } from "@lib/util/cn"
import SideDrawer from "@modules/common/components/side-drawer"
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
import { buildPublicMediaUrl } from "@/lib/util/media-url"

type CustomerApiResponse = {
  id?: string
}

type CustomerLookupState = "loading" | "authenticated" | "guest"

const CustomerReviews = ({
  productId,
  productHandle,
  reviews = [],
  productThumbnail,
}: {
  productId: string
  productHandle: string
  reviews?: ReviewWithMedia[]
  productThumbnail?: string | null
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [customerLookupState, setCustomerLookupState] =
    useState<CustomerLookupState>("loading")
  const reviewForm = useReviewForm()

  useEffect(() => {
    let shouldIgnoreResponse = false

    const loadCustomerState = async () => {
      try {
        const response = await fetch("/api/customer", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch customer state: ${response.status}`)
        }

        const customerData = (await response.json()) as CustomerApiResponse

        if (shouldIgnoreResponse) {
          return
        }

        setCustomerLookupState(
          customerData.id ? "authenticated" : "guest"
        )
      } catch (error) {
        if (shouldIgnoreResponse) {
          return
        }

        console.error("Failed to load review customer state:", error)

        setCustomerLookupState("guest")
      }
    }

    void loadCustomerState()

    return () => {
      shouldIgnoreResponse = true
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = reviewForm.validate()
    if (validationError) {
      setErrorMessage(validationError)
      setErrorModalOpen(true)
      return
    }

    setStatus("submitting")

    try {
      const uploadedMedia: ReviewData["media"] = await uploadReviewMedia({
        files: reviewForm.files,
        audioBlob: reviewForm.voiceRecorder.audioBlob,
        voiceFilePrefix: "voice-review",
      })

      // 2. Submit Review Data
      const result = await submitReview({
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
      setTimeout(() => {
        setIsModalOpen(false)
        setStatus("idle")
        reviewForm.reset()
      }, 2000)
    } catch (error) {
      // Provide user-friendly error if possible
      const msg =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      setErrorMessage(msg)
      setErrorModalOpen(true)
    }
  }

  const { averageRating, totalRatings, distribution } = useMemo(() => {
    const total = reviews.length
    const dist = [0, 0, 0, 0, 0] // 5, 4, 3, 2, 1
    let sum = 0

    reviews.forEach((r) => {
      const starIndex = 5 - Math.round(r.rating)
      if (starIndex >= 0 && starIndex < 5) {
        dist[starIndex]++
      }
      sum += r.rating
    })

    return {
      averageRating: total > 0 ? (sum / total).toFixed(1) : "0.0",
      totalRatings: total,
      distribution: dist.map((count) => ({
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
    }
  }, [reviews])

  const [activeVideo, setActiveVideo] = useState<{ url: string, quote?: string, author: string } | null>(null)
  const [displayCount, setDisplayCount] = useState(3)
  const visibleReviews = reviews.slice(0, displayCount)
  const canWriteReview = customerLookupState === "authenticated"
  const isCustomerStateLoading = customerLookupState === "loading"


  return (
    <div className="flex flex-col gap-8">
      {/* 1. Summary Header Section */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
          {/* Left Side: Average Score */}
          <div className="flex flex-col rounded-2xl bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between lg:w-[280px] lg:flex-col lg:items-start lg:justify-start">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                Customer rating
              </p>
              <div className="mt-3 flex items-end gap-2">
                <h2 className="text-5xl font-black leading-none tracking-tight text-slate-950">{averageRating}</h2>
                <span className="mb-1 text-sm font-bold text-slate-400">/ 5</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-5 w-5 transition-colors",
                    i < Math.round(Number(averageRating))
                      ? "text-indigo-500 fill-indigo-500"
                      : "text-gray-200"
                  )}
                />
              ))}
            </div>
            <p className="mt-2 text-xs font-bold text-slate-500">
              Based on {totalRatings.toLocaleString()} {totalRatings === 1 ? "review" : "reviews"}
            </p>

            {isCustomerStateLoading ? (
              <button
                type="button"
                disabled
                className="mt-6 flex cursor-wait items-center gap-2 rounded-xl bg-gray-200 px-6 py-3.5 text-xs font-bold text-gray-500 transition-all"
              >
                Checking account...
              </button>
            ) : canWriteReview ? (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="mt-6 flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3.5 text-xs font-bold text-white transition-all hover:bg-gray-800"
              >
                Write A Review
              </button>
            ) : (
              <LocalizedClientLink
                href={`/login?returnUrl=${encodeURIComponent(`/products/${productHandle}`)}`}
                className="mt-6 flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3.5 text-xs font-bold text-white transition-all hover:bg-gray-800"
              >
                Login to Write a Review
              </LocalizedClientLink>
            )}
          </div>

          {/* Right Side: Distribution Bars */}
          <div className="w-full flex-1 space-y-3 rounded-2xl border border-slate-100 p-5">
            {distribution.map((item, index) => {
              const label = (5 - index).toFixed(1)
              return (
                <div key={index} className="group flex items-center gap-3 sm:gap-4">
                  <span className="min-w-[28px] text-xs font-bold text-gray-500 transition-colors group-hover:text-indigo-500">{label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-indigo-500 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] rounded-full shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                      style={{ width: `${item.percentage}%` }}
                      role="progressbar"
                      aria-valuenow={item.percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                  <div className="min-w-[68px] text-right sm:min-w-[80px]">
                    <span className="text-[10px] font-bold tracking-tight text-gray-500">
                      {item.count >= 1000 ? `${(item.count / 1000).toFixed(1)}K` : item.count} reviews
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 2. Write Review Side Drawer */}
      <SideDrawer
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Write a Review"
        size="medium"
      >
        {status === "success" ? (
          <div className="flex h-full flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-500">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-50 text-green-500 shadow-inner">
              <ShieldCheck className="h-12 w-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Review Submitted!</h3>
            <p className="text-slate-500 max-w-[280px] font-medium leading-relaxed">
              Thank you for sharing your experience. Your review is being processed.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <ReviewRatingPicker
              value={reviewForm.values.rating}
              onChange={(rating) => reviewForm.updateField("rating", rating)}
              variant="customer"
            />

            <ReviewTextInput
              label="Review Title"
              value={reviewForm.values.title}
              placeholder="Summarize your experience"
              onChange={(value) => reviewForm.updateField("title", value)}
              required
              variant="customer"
            />

            <ReviewTextarea
              label="Detailed Review"
              value={reviewForm.values.content}
              placeholder="What did you think about the product?"
              onChange={(value) => reviewForm.updateField("content", value)}
              variant="customer"
            />

            <ReviewMediaUploader
              files={reviewForm.files}
              inputResetKey={reviewForm.mediaInputResetKey}
              onFileChange={reviewForm.handleFileChange}
              onRemoveFile={reviewForm.removeFile}
              variant="customer"
            />

            <ReviewVoiceRecorderPanel
              voiceRecorder={reviewForm.voiceRecorder}
              variant="customer"
            />

            <ReviewTextInput
              label="Display Name"
              value={reviewForm.values.displayName}
              onChange={(value) => reviewForm.updateField("displayName", value)}
              placeholder="How you'll appear publically"
              required={!reviewForm.values.isAnonymous}
              variant="customer"
            />

            <div className="pt-2">
              <ReviewAnonymousToggle
                checked={reviewForm.values.isAnonymous}
                onChange={(checked) => reviewForm.updateField("isAnonymous", checked)}
                variant="customer"
              />
            </div>

            <div className="flex items-center gap-3 pt-6 border-t border-gray-100">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
                Discard
              </Button>
              <Button type="submit" disabled={status === "submitting"} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                {status === "submitting" ? "Uploading..." : "Publish Review"}
              </Button>
            </div>
          </form>
        )}
      </SideDrawer>

      {/* 3. Error Modal */}
      <Modal isOpen={errorModalOpen} close={() => setErrorModalOpen(false)}>
        <Modal.Title>System Notice</Modal.Title>
        <Modal.Body>
          <div className="py-6 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8" />
            </div>
            <p className="text-gray-900 font-bold mb-2 text-lg">Update Failed</p>
            <p className="text-gray-500 leading-relaxed">{errorMessage}</p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setErrorModalOpen(false)} className="w-full bg-slate-900">
            Acknowledge
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 4. Reviews List */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleReviews.map((review) => (
          <article
            key={review.id}
            className="flex h-full min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between xl:flex-col 2xl:flex-row">
              <div className="flex min-w-0 items-center gap-4">
                <div className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-black text-white",
                  review.is_anonymous
                    ? "bg-slate-200 text-slate-400"
                    : "bg-gradient-to-br from-indigo-500 to-purple-600"
                )}>
                  {review.is_anonymous ? (
                    <User className="w-6 h-6" />
                  ) : (
                    review.display_name?.[0]?.toUpperCase() || "A"
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-base font-black leading-tight text-gray-900">
                    {review.is_anonymous ? "Verified Buyer" : (review.display_name || "Verified Buyer")}
                  </h4>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 self-start rounded-xl border border-gray-200 bg-gray-50 px-4 py-2">
                <span className="text-base font-black text-gray-900 leading-none">{review.rating.toFixed(1)}</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-3.5 w-3.5",
                        i < Math.round(review.rating)
                          ? "text-indigo-500 fill-indigo-500"
                          : "text-gray-200"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 min-w-0 flex-1">
              {review.title && <h5 className="mb-2 text-lg font-black leading-tight text-gray-950">{review.title}</h5>}
              {review.content && (
                <p className="whitespace-pre-wrap text-sm font-medium leading-7 text-gray-600">
                  {review.content}
                </p>
              )}
            </div>

            {/* Media Gallery Grid */}
            {review.review_media && review.review_media.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                {review.review_media.map((media) => {
                  const publicUrl = buildPublicMediaUrl(media.file_path)

                  if (media.file_type === 'video') {
                    return (
                      <div
                        key={media.id}
                        className="group relative aspect-square w-full cursor-pointer overflow-hidden rounded-2xl border border-gray-100 bg-slate-100 transition-all hover:border-indigo-200 hover:shadow-md"
                        onClick={() => setActiveVideo({
                          url: publicUrl,
                          quote: review.content,
                          author: review.display_name || "Verified Buyer"
                        })}
                      >
                        {productThumbnail ? (
                          <Image
                            src={productThumbnail}
                            alt="video thumbnail"
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 160px"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-slate-100" />
                        )}
                        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-sm">
                          <Video className="h-3 w-3" />
                          Video
                        </div>
                        <div className="absolute inset-0 bg-slate-900/25 transition-colors group-hover:bg-indigo-900/10" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-md border border-white/40 flex items-center justify-center transition-all group-hover:scale-110 group-hover:bg-white/50">
                            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (media.file_type === 'audio') {
                    return (
                      <div key={media.id} className="col-span-full rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md">
                        <div className="mb-3 flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 shadow-inner">
                            <Mic className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div>
                            <span className="block text-[9px] font-black uppercase tracking-widest text-indigo-500">Voice Review</span>
                            <span className="text-xs font-bold text-slate-600">Listen to this customer note</span>
                          </div>
                        </div>
                        <audio controls preload="none" src={publicUrl} className="h-10 w-full min-w-0" />
                      </div>
                    )
                  }

                  return (
                    <div key={media.id} className="group relative aspect-square w-full flex-shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-gray-100 bg-slate-100 transition-all hover:border-indigo-200 hover:shadow-md">
                      <Image
                        src={publicUrl}
                        alt="review media"
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 160px"
                      />
                      <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700 backdrop-blur-sm">
                        <ImageIcon className="h-3 w-3" />
                        Photo
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </article>
        ))}
      </div>

      {/* Read More Section */}
      {reviews.length > displayCount && (
        <div className="flex justify-center pt-6">
          <button
            onClick={() => setDisplayCount(prev => prev + 5)}
            className="flex items-center gap-2 rounded-xl bg-white border-2 border-indigo-50 px-6 py-3 text-xs font-black text-indigo-600 transition-all hover:bg-indigo-50 hover:border-indigo-100 hover:shadow-lg active:scale-95 text-nowrap"
          >
            Show More Reviews <X className="w-4 h-4 rotate-45" />
          </button>
        </div>
      )}

      {/* Video Play Modal - Immersive Refinement */}
      <Transition show={!!activeVideo} as={Fragment}>
        <Dialog as="div" className="relative z-[200]" onClose={() => setActiveVideo(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-white/90 backdrop-blur-3xl" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="relative">
                  <video
                    src={activeVideo?.url}
                    controls
                    autoPlay
                    preload="metadata"
                    className="max-h-[85vh] w-auto max-w-full rounded-2xl"
                  />
                  <button
                    onClick={() => setActiveVideo(null)}
                    className="absolute -top-12 right-0 md:-right-12 text-gray-900/80 transition-all hover:text-gray-900 hover:scale-110 active:scale-95 z-20"
                  >
                    <X className="w-8 h-8" />
                  </button>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}

export default CustomerReviews
