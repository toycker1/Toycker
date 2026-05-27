"use client"

import { useCallback, useEffect, useRef, useState, useMemo, type MouseEvent } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Mic, Pause, Play, Star } from "lucide-react"
import useEmblaCarousel from "embla-carousel-react"
import { cn } from "@lib/util/cn"
import { getImageUrl } from "@/lib/util/get-image-url"
import { type HomeReview } from "@/lib/actions/home-reviews"

type ReviewType = "text" | "video" | "image" | "audio"

type BaseReview = {
  id: string
  type: ReviewType
  quote?: string
  summary?: string
  videoSrc?: string | null
  audioSrc?: string | null
  posterSrc?: string | null
  author: string
  avatar: string
  tag?: string
  cardBg?: string
  cardBorder?: string
  productImage?: string | null
}

type Review = BaseReview

const formatAudioTime = (timeInSeconds: number) => {
  if (!Number.isFinite(timeInSeconds)) {
    return "0:00"
  }

  const minutes = Math.floor(timeInSeconds / 60)
  const seconds = Math.floor(timeInSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

const AudioReviewPlayer = ({ src, title }: { src: string; title: string }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const progress = duration > 0 ? Math.min(Math.max(currentTime / duration, 0), 1) : 0

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (audio.paused) {
      try {
        await audio.play()
        setIsPlaying(true)
      } catch {
        setIsPlaying(false)
      }
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  const handleProgressClick = (event: MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1)
    audio.currentTime = ratio * duration
    setCurrentTime(audio.currentTime)
  }

  return (
    <div className="rounded-2xl border border-[#ffe2b8] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={togglePlayback}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#111827] text-white transition hover:bg-[#263244]"
          aria-label={`${isPlaying ? "Pause" : "Play"} ${title}`}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
        </button>

        <div className="min-w-0 flex-1">
          <div
            role="slider"
            aria-label={`Audio progress for ${title}`}
            aria-valuemin={0}
            aria-valuemax={duration || 1}
            aria-valuenow={currentTime}
            tabIndex={0}
            onClick={handleProgressClick}
            className="relative h-2 cursor-pointer rounded-full bg-[#f3e1c5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f59e0b]"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-[#f59e0b]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[#7c5c2e]">
            <span>{formatAudioTime(currentTime)}</span>
            <span>{duration > 0 ? formatAudioTime(duration) : "Audio"}</span>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onEnded={() => {
          setIsPlaying(false)
          setCurrentTime(0)
        }}
      >
        <track kind="captions" />
      </audio>
    </div>
  )
}


const ReviewCard = ({ review }: { review: Review }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const renderStars = (colorClass: string, extraClasses = "") => (
    <div className={`flex items-center gap-1.5 ${extraClasses}`} aria-label="Rated 5 out of 5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={`h-5 w-5 fill-current ${colorClass}`} />
      ))}
    </div>
  )

  const handlePlayClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    const video = videoRef.current
    if (!video) {
      return
    }
    video.controls = true
    try {
      await video.play()
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
    }
  }

  const handlePauseClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    const video = videoRef.current
    if (!video) {
      return
    }
    video.pause()
    setIsPlaying(false)
  }

  if (review.type === "video" && review.videoSrc) {
    const videoPoster = review.posterSrc || review.productImage || undefined

    return (
      <article className="group relative flex h-[480px] flex-col overflow-hidden rounded-3xl bg-black text-white">
        <video
          ref={videoRef}
          controls={isPlaying}
          playsInline
          preload="none"
          poster={videoPoster}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105"
          aria-label={`Video review from ${review.author}`}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        >
          <source src={review.videoSrc ?? undefined} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/80 transition-opacity duration-300 ${isPlaying ? "opacity-0" : ""}`}
        />

        <div
          className={`relative z-10 flex h-full flex-col justify-between p-6 transition-opacity duration-500 ${isPlaying ? "opacity-0" : ""}`}
        >
          <div className="flex items-start text-sm font-semibold tracking-wide">
            {review.tag && (
              <span className="max-w-full rounded-2xl bg-white/85 px-3 py-2 text-xs leading-snug text-[#1f2937] shadow-sm">
                {review.tag}
              </span>
            )}
          </div>

          <div>
            {review.quote && (
              <p className="text-2xl font-semibold leading-snug text-white">“{review.quote}”</p>
            )}
            <p className="mt-6 text-sm font-semibold text-white">{review.author}</p>
            {renderStars("text-white")}
          </div>
        </div>

        {review.type === "video" && !isPlaying && (
          <button
            type="button"
            aria-label={`Play ${review.author}'s story`}
            onClick={handlePlayClick}
            className="absolute inset-x-0 bottom-6 z-40 mx-auto flex w-max items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#111827] opacity-0 transition delay-150 group-hover:translate-y-0 group-hover:opacity-100"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#111827] text-white">
              <Play className="h-3.5 w-3.5" />
            </span>
            Play story
          </button>
        )}
        {review.type === "video" && isPlaying && (
          <button
            type="button"
            aria-label={`Pause ${review.author}'s story`}
            onClick={handlePauseClick}
            className="absolute inset-x-0 bottom-6 z-40 mx-auto flex w-max items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-[#111827]"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#111827] text-white">
              <Pause className="h-3.5 w-3.5" />
            </span>
            Pause
          </button>
        )}
      </article>
    )
  }

  const cardBg = review.cardBg ?? "bg-white"
  const cardBorder = review.cardBorder ?? "border-white/70"
  const productImage = review.productImage || review.posterSrc || review.avatar || "/assets/images/placeholder.jpg"
  const productName = review.tag ?? "Featured product"

  if (review.type === "audio" && review.audioSrc) {
    return (
      <article className={`flex h-[480px] flex-col rounded-3xl border ${cardBorder} ${cardBg} p-6 overflow-hidden`}>
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-white border border-black/5">
            <Image src={productImage} alt={productName} fill sizes="80px" className="object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-3 break-words text-sm font-bold uppercase leading-relaxed tracking-[0.2em] text-[#9ca3af]">
              {productName}
            </p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#c45700]">
              <Mic className="h-3.5 w-3.5" />
              Audio review
            </span>
          </div>
        </div>

        <div className="mt-6 flex min-h-0 flex-1 flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-[#ffe2b8] bg-white/70 p-5">
          {review.quote && (
            <blockquote className="line-clamp-6 text-xl font-semibold leading-relaxed text-[#111827]">
              “{review.quote}”
            </blockquote>
          )}
          <AudioReviewPlayer src={review.audioSrc} title={productName} />
        </div>

        <div className={`mt-6 border-t ${cardBorder} pt-4 shrink-0`}>
          <p className="font-bold italic text-[#111827]">{review.author}</p>
          {renderStars("text-[#fbbf24]", "mt-2")}
        </div>
      </article>
    )
  }

  return (
    <article className={`flex h-[480px] flex-col rounded-3xl border ${cardBorder} ${cardBg} p-6 overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-white border border-black/5">
          <Image src={productImage} alt={productName} fill sizes="80px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          {productName && (
            <p className="line-clamp-3 break-words text-sm font-bold uppercase leading-relaxed tracking-[0.2em] text-[#9ca3af]">
              {productName}
            </p>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        {review.quote && (
          <blockquote className="line-clamp-4 text-lg font-medium leading-relaxed text-[#111827]">“{review.quote}”</blockquote>
        )}

        {/* Review Image Box - Displayed separately below the text if available */}
        {review.type === "image" && review.posterSrc && (
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/50 shadow-sm ring-4 ring-white/10">
            <Image src={review.posterSrc} alt="Review attachment" fill className="object-cover" />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`mt-6 border-t ${cardBorder} pt-4 shrink-0`}>
        <p className="font-bold italic text-[#111827]">{review.author}</p>
        {renderStars("text-[#fbbf24]", "mt-2")}
      </div>
    </article>
  )
}

const ReviewMediaHub = ({ reviews = [] }: { reviews: HomeReview[] }) => {
  const [isMounted, setIsMounted] = useState(false)

  // Map dynamic reviews to the internal types
  const displayReviews: Review[] = useMemo(() => {
    return reviews
      .map(hr => {
        const r = hr.review
        if (!r) return null
        const videoMedia = r.review_media?.find(m => m.file_type === 'video')
        const audioMedia = r.review_media?.find(m => m.file_type === 'audio')
        const imageMedia = r.review_media?.find(m => m.file_type === 'image')

        const product = r.product

        let type: ReviewType = 'text'
        if (videoMedia) type = 'video'
        else if (audioMedia) type = 'audio'
        else if (imageMedia) type = 'image'

        return {
          id: r.id,
          type,
          quote: r.content,
          author: r.is_anonymous ? "Verified Buyer" : (r.display_name || "Verified Buyer"),
          avatar: "",
          videoSrc: videoMedia ? getImageUrl(videoMedia.file_path) : undefined,
          audioSrc: audioMedia ? getImageUrl(audioMedia.file_path) : undefined,
          posterSrc: imageMedia ? getImageUrl(imageMedia.file_path) : undefined,
          tag: product?.name,
          productImage: product?.image_url ? getImageUrl(product.image_url) : undefined,
          cardBg: r.rating >= 4 ? "bg-[#fffdf4]" : "bg-[#f0fbff]",
          cardBorder: r.rating >= 4 ? "border-[#fde9c8]" : "border-[#cdeefd]"
        }
      })
      .filter(r => r !== null) as Review[]
  }, [reviews])
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
  })

  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  type EmblaApiType = NonNullable<ReturnType<typeof useEmblaCarousel>[1]>

  const onSelect = useCallback((api: EmblaApiType) => {
    setCanScrollPrev(api.canScrollPrev())
    setCanScrollNext(api.canScrollNext())
  }, [])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!emblaApi) return
    onSelect(emblaApi)
    emblaApi.on("select", () => onSelect(emblaApi))
    emblaApi.on("reInit", () => onSelect(emblaApi))
  }, [emblaApi, onSelect])

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext()
  }, [emblaApi])

  // If no reviews at all, don't render the section
  if (isMounted && displayReviews.length === 0) {
    return null
  }

  return (
    <>
      <section className="w-full" aria-labelledby="review-media-hub-heading">
        <div className="mx-auto max-w-screen-2xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#c45700]">Customer say!</p>
              <h2 id="review-media-hub-heading" className="mt-3 text-4xl font-semibold text-[#111827]">
                Trusted by parents and creators across India
              </h2>
            </div>
          </div>

          {displayReviews.length > 0 && (
            !isMounted ? (
              <div className="h-[480px] animate-pulse bg-ui-bg-subtle rounded-3xl" />
            ) : (
              <div className="relative">
                <div className="overflow-hidden" ref={emblaRef}>
                  <div className="flex -ml-8">
                    {displayReviews.map((review) => (
                      <div
                        key={review.id}
                        className="flex-[0_0_100%] pl-8 min-w-0 sm:flex-[0_0_83.333%] md:flex-[0_0_50%] xl:flex-[0_0_33.333%]"
                      >
                        <ReviewCard review={review} />
                      </div>
                    ))}
                  </div>
                </div>

                {displayReviews.length > 1 && (
                  <div className="absolute -bottom-20 left-0 right-0 flex justify-between px-4 pb-4 z-10 sm:left-auto sm:flex-none sm:justify-normal sm:gap-4 sm:pr-4">
                    <button
                      type="button"
                      onClick={scrollPrev}
                      aria-label="Previous reviews"
                      className={cn(
                        "inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white transition",
                        !canScrollPrev && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={scrollNext}
                      aria-label="Next reviews"
                      className={cn(
                        "inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white transition",
                        !canScrollNext && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
            )
          )}

        </div>
      </section>
    </>
  )
}

export default ReviewMediaHub
