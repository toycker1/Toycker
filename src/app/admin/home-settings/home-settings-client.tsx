"use client"

import { useEffect, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import { type HomeBanner } from "@/lib/types/home-banners"
import { type HomeExclusiveCollection } from "@/lib/types/home-exclusive-collections"
import { type HomeReview } from "@/lib/actions/home-reviews"
import { getAllReviewsForAdmin, type ReviewWithMedia } from "@/lib/actions/reviews"

const ManagerLoading = () => (
    <div className="min-h-[360px] rounded-xl border border-dashed border-gray-200 bg-gray-50/50" />
)

const BannersManager = dynamic(
    () => import("@/modules/admin/components/home-settings/banners-manager"),
    { ssr: false, loading: ManagerLoading }
)
const ExclusiveCollectionsManager = dynamic(
    () => import("@/modules/admin/components/home-settings/exclusive-collections-manager"),
    { ssr: false, loading: ManagerLoading }
)
const ReviewsManager = dynamic(
    () => import("@/modules/admin/components/home-settings/reviews-manager"),
    { ssr: false, loading: ManagerLoading }
)

type HomeSettingsTab = "banners" | "collections" | "reviews"

type Props = {
    banners: HomeBanner[]
    collections: HomeExclusiveCollection[]
    homeReviews: HomeReview[]
}

export default function HomeSettingsClient({ banners, collections, homeReviews }: Props) {
    const [activeTab, setActiveTab] = useState<HomeSettingsTab>("banners")
    const [allApprovedReviews, setAllApprovedReviews] = useState<ReviewWithMedia[] | null>(null)
    const [reviewsLoadError, setReviewsLoadError] = useState<string | null>(null)
    const [isLoadingReviews, startLoadingReviews] = useTransition()

    const tabs: Array<{
        id: HomeSettingsTab
        label: string
        description: string
        count: number
    }> = [
        {
            id: "banners",
            label: "Hero Banners",
            description: "Large promotional banners shown at the top of the homepage.",
            count: banners.length
        },
        {
            id: "collections",
            label: "Exclusive Collections",
            description: "Product collections featured with full-screen video content.",
            count: collections.length
        },
        {
            id: "reviews",
            label: "Customer Reviews",
            description: "Up to 12 approved reviews featured on the homepage.",
            count: homeReviews.length
        }
    ]

    useEffect(() => {
        if (activeTab !== "reviews" || allApprovedReviews) {
            return
        }

        startLoadingReviews(async () => {
            try {
                const { reviews } = await getAllReviewsForAdmin({ limit: 100 })
                setReviewsLoadError(null)
                setAllApprovedReviews(
                    reviews.filter((review) => review.approval_status === "approved")
                )
            } catch (error) {
                setReviewsLoadError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load approved reviews."
                )
                setAllApprovedReviews([])
            }
        })
    }, [activeTab, allApprovedReviews])

    return (
        <>
            {/* Header section with glass effect on scroll (conceptual) */}
            <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900">Home Appearance</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Manage your storefront&apos;s first impression. Customize banners, featured collections, and top-rated customer reviews.
                </p>
            </div>

            <div className="flex flex-col gap-8">
                {/* Modern Tab Navigation */}
                <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl w-fit border border-gray-200/50">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id
                                ? "bg-white text-black shadow-sm"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                }`}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`ml-1 px-2 py-0.5 rounded-md text-[10px] font-black ${activeTab === tab.id
                                    ? "bg-indigo-50 text-indigo-600"
                                    : "bg-slate-200 text-slate-500"
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content Area with refined borders and shadows */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[600px]">
                    <div className="p-6 sm:p-10">
                        <div className="border-b border-gray-200 pb-8">
                            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                {tabs.find(t => t.id === activeTab)?.label}
                                <div className="h-1 w-1 rounded-full bg-gray-300" />
                                <span className="text-sm font-medium text-gray-400">Settings</span>
                            </h2>
                            <p className="text-sm text-gray-500 mt-2 font-medium">
                                {tabs.find(t => t.id === activeTab)?.description}
                            </p>
                        </div>

                        <div className="mt-8">
                            {activeTab === "banners" && (
                                <BannersManager initialBanners={banners} />
                            )}
                            {activeTab === "collections" && (
                                <ExclusiveCollectionsManager initialCollections={collections} />
                            )}
                            {activeTab === "reviews" && (
                                allApprovedReviews ? (
                                    <ReviewsManager
                                        initialHomeReviews={homeReviews}
                                        allApprovedReviews={allApprovedReviews}
                                    />
                                ) : (
                                    <div className="min-h-[360px] rounded-xl border border-dashed border-gray-200 bg-gray-50/50" />
                                )
                            )}
                            {activeTab === "reviews" && reviewsLoadError && (
                                <p className="mt-4 text-sm font-medium text-red-600">
                                    {reviewsLoadError}
                                </p>
                            )}
                            {activeTab === "reviews" && isLoadingReviews && (
                                <p className="mt-4 text-sm font-medium text-gray-500">
                                    Loading approved reviews...
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
