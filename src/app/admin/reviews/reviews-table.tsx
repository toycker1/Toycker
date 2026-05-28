"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { approveReview, rejectReview, deleteReview, deleteReviews, type ReviewWithMedia } from "@/lib/actions/reviews"
import { Star, Eye, Check, X, Trash2, Video, Mic, Image as ImageIcon, AlertTriangle, Loader2 } from "lucide-react"
import { ProtectedAction } from "@/lib/permissions/components/protected-action"
import { PERMISSIONS } from "@/lib/permissions"
import clsx from "clsx"
import { formatIST } from "@/lib/util/date"
import { AdminTableWrapper } from "@modules/admin/components/admin-table-wrapper"
import { buildPublicMediaUrl } from "@/lib/util/media-url"
import Modal from "@modules/common/components/modal"

type ReviewMedia = ReviewWithMedia["review_media"][number]
type ReviewTab = "all" | "pending" | "approved" | "rejected" | "voice"
type ReviewAction = "approve" | "reject" | "delete"
type ReviewActionRequest = {
    action: ReviewAction
    review: ReviewWithMedia
}
type PendingReviewAction = ReviewActionRequest | null
type ReviewActionStatus = "idle" | "submitting" | "refreshing"
type BulkDeleteStatus = "idle" | "submitting" | "refreshing"

const REVIEW_TABS: ReviewTab[] = ["all", "pending", "approved", "rejected", "voice"]

const REVIEW_ACTION_STATUS: Record<Exclude<ReviewAction, "delete">, "approved" | "rejected"> = {
    approve: "approved",
    reject: "rejected",
}

export default function ReviewsTable({ reviews }: { reviews: ReviewWithMedia[] }) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<ReviewTab>("all")
    const [selectedReview, setSelectedReview] = useState<ReviewWithMedia | null>(null)
    const [actionStatus, setActionStatus] = useState<ReviewActionStatus>("idle")
    const [pendingAction, setPendingAction] = useState<PendingReviewAction>(null)
    const [inFlightAction, setInFlightAction] = useState<PendingReviewAction>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([])
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
    const [bulkDeleteStatus, setBulkDeleteStatus] = useState<BulkDeleteStatus>("idle")
    const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)
    const hasProcessingAction = actionStatus !== "idle"
    const hasProcessingBulkDelete = bulkDeleteStatus !== "idle"
    const hasProcessingState = hasProcessingAction || hasProcessingBulkDelete

    useEffect(() => {
        if (!inFlightAction || actionStatus !== "refreshing") {
            return
        }

        const refreshedReview = reviews.find(
            (review) => review.id === inFlightAction.review.id
        )
        const actionIsVisible =
            inFlightAction.action === "delete"
                ? !refreshedReview
                : refreshedReview?.approval_status === REVIEW_ACTION_STATUS[inFlightAction.action]

        if (!actionIsVisible) {
            return
        }

        setSelectedReview(null)
        setPendingAction(null)
        setInFlightAction(null)
        setActionError(null)
        setActionStatus("idle")
    }, [actionStatus, inFlightAction, reviews])

    const isActionProcessing = (action: ReviewAction, reviewId: string) =>
        inFlightAction?.action === action &&
        inFlightAction.review.id === reviewId &&
        hasProcessingAction

    useEffect(() => {
        if (bulkDeleteStatus !== "refreshing") {
            return
        }

        const remainingSelectedIds = selectedReviewIds.filter((reviewId) =>
            reviews.some((review) => review.id === reviewId)
        )

        if (remainingSelectedIds.length > 0) {
            return
        }

        setSelectedReviewIds([])
        setIsBulkDeleteOpen(false)
        setBulkDeleteError(null)
        setBulkDeleteStatus("idle")
    }, [bulkDeleteStatus, reviews, selectedReviewIds])

    const filteredReviews = reviews.filter((r) => {
        if (activeTab === "all") return true
        if (activeTab === "voice") return r.review_media?.some((m) => m.file_type === 'audio')
        return r.approval_status === activeTab
    })

    // Sort: Pending first for "all" tab, otherwise date desc
    const sortedReviews = [...filteredReviews].sort((a, b) => {
        if (activeTab === "all") {
            if (a.approval_status === "pending" && b.approval_status !== "pending") return -1
            if (a.approval_status !== "pending" && b.approval_status === "pending") return 1
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    const sortedReviewIds = sortedReviews.map((review) => review.id)
    const selectedCount = selectedReviewIds.length
    const selectedVisibleCount = sortedReviewIds.filter((reviewId) =>
        selectedReviewIds.includes(reviewId)
    ).length
    const allVisibleSelected =
        sortedReviewIds.length > 0 && selectedVisibleCount === sortedReviewIds.length

    const toggleReviewSelection = (reviewId: string) => {
        if (hasProcessingState) {
            return
        }

        setSelectedReviewIds((current) =>
            current.includes(reviewId)
                ? current.filter((id) => id !== reviewId)
                : [...current, reviewId]
        )
    }

    const toggleVisibleSelection = () => {
        if (hasProcessingState || sortedReviewIds.length === 0) {
            return
        }

        setSelectedReviewIds((current) => {
            if (allVisibleSelected) {
                return current.filter((reviewId) => !sortedReviewIds.includes(reviewId))
            }

            return Array.from(new Set([...current, ...sortedReviewIds]))
        })
    }

    const openBulkDeleteDialog = () => {
        if (selectedCount === 0 || hasProcessingState) {
            return
        }

        setBulkDeleteError(null)
        setIsBulkDeleteOpen(true)
    }

    const closeBulkDeleteDialog = () => {
        if (hasProcessingBulkDelete) {
            return
        }

        setIsBulkDeleteOpen(false)
        setBulkDeleteError(null)
    }

    const handleBulkDelete = async () => {
        if (selectedReviewIds.length === 0) {
            return
        }

        setBulkDeleteStatus("submitting")
        setBulkDeleteError(null)

        try {
            const result = await deleteReviews(selectedReviewIds)

            if (result?.error) {
                throw new Error(result.error)
            }

            setBulkDeleteStatus("refreshing")
            router.refresh()
        } catch (error) {
            console.error("Bulk review delete failed:", error)
            setBulkDeleteError(
                error instanceof Error
                    ? error.message
                    : "Failed to delete selected reviews."
            )
            setBulkDeleteStatus("idle")
        }
    }

    const openActionDialog = (action: ReviewAction, review: ReviewWithMedia) => {
        if (hasProcessingState) {
            return
        }

        setActionError(null)
        setPendingAction({ action, review })
    }

    const closeActionDialog = () => {
        if (hasProcessingState) {
            return
        }

        setPendingAction(null)
        setActionError(null)
    }

    const handleAction = async () => {
        if (!pendingAction) {
            return
        }

        await runReviewAction(pendingAction)
    }

    const runReviewAction = async (reviewAction: ReviewActionRequest) => {
        setActionStatus("submitting")
        setInFlightAction(reviewAction)
        setActionError(null)

        try {
            const result =
                reviewAction.action === "approve"
                    ? await approveReview(reviewAction.review.id)
                    : reviewAction.action === "reject"
                        ? await rejectReview(reviewAction.review.id)
                        : await deleteReview(reviewAction.review.id)

            if (result?.error) {
                throw new Error(result.error)
            }

            setActionStatus("refreshing")
            router.refresh()
        } catch (error) {
            console.error("Review action failed:", error)
            setActionError(
                error instanceof Error
                    ? error.message
                    : "Action failed. Please try again."
            )
            setInFlightAction(null)
            setActionStatus("idle")
        }
    }

    const runDetailAction = (action: Exclude<ReviewAction, "delete">, review: ReviewWithMedia) => {
        void runReviewAction({ action, review })
    }

    return (
        <div className="bg-white rounded-lg shadow border border-gray-200">
            {/* Tabs */}
            <div className="border-b border-gray-200 px-6 flex gap-6">
                {REVIEW_TABS.map((tab) => {
                    const count = tab === 'all'
                        ? reviews.length
                        : tab === 'voice'
                            ? reviews.filter(r => r.review_media?.some((m) => m.file_type === 'audio')).length
                            : reviews.filter(r => r.approval_status === tab).length

                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                "py-4 text-sm font-medium border-b-2 transition-colors capitalize flex items-center gap-2",
                                activeTab === tab
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            )}
                        >
                            {tab === 'voice' && <Mic className="h-4 w-4" />}
                            {tab}
                            <span className="py-0.5 px-2 rounded-full bg-gray-100 text-xs text-gray-600">
                                {count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {selectedCount > 0 && (
                <div className="flex flex-col gap-3 border-b border-gray-200 bg-indigo-50/60 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-gray-700">
                        {selectedCount} review{selectedCount === 1 ? "" : "s"} selected
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={hasProcessingState}
                            onClick={() => setSelectedReviewIds([])}
                        >
                            Clear Selection
                        </button>
                        <ProtectedAction permission={PERMISSIONS.REVIEWS_DELETE} hideWhenDisabled>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={hasProcessingState}
                                onClick={openBulkDeleteDialog}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete Selected
                            </button>
                        </ProtectedAction>
                    </div>
                </div>
            )}

            {/* Table */}
            <AdminTableWrapper>
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                            <th className="w-12 px-6 py-3 font-medium">
                                <input
                                    type="checkbox"
                                    aria-label="Select all visible reviews"
                                    checked={allVisibleSelected}
                                    disabled={sortedReviewIds.length === 0 || hasProcessingState}
                                    onChange={toggleVisibleSelection}
                                    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </th>
                            <th className="px-6 py-3 font-medium">Product / Title</th>
                            <th className="px-6 py-3 font-medium">Reviewer</th>
                            <th className="px-6 py-3 font-medium">Rating</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {sortedReviews.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                    No reviews found.
                                </td>
                            </tr>
                        ) : (
                            sortedReviews.map((review) => (
                                <tr key={review.id} className="hover:bg-gray-50/50">
                                    <td className="px-6 py-4 align-top">
                                        <input
                                            type="checkbox"
                                            aria-label={`Select review ${review.title}`}
                                            checked={selectedReviewIds.includes(review.id)}
                                            disabled={hasProcessingState}
                                            onChange={() => toggleReviewSelection(review.id)}
                                            className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900 line-clamp-1 max-w-xs">{review.product_name}</span>
                                            <span className="text-gray-500 text-xs line-clamp-1">{review.title}</span>
                                            {review.review_media?.length > 0 && (
                                                <div className="flex gap-2 mt-1.5">
                                                    {review.review_media.some((m) => m.file_type === 'image') && (
                                                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                                            <ImageIcon className="h-3 w-3" />
                                                            {review.review_media.filter((m) => m.file_type === 'image').length}
                                                        </span>
                                                    )}
                                                    {review.review_media.some((m) => m.file_type === 'video') && (
                                                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                                            <Video className="h-3 w-3" />
                                                            {review.review_media.filter((m) => m.file_type === 'video').length}
                                                        </span>
                                                    )}
                                                    {review.review_media.some((m) => m.file_type === 'audio') && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider border border-indigo-100 shadow-sm">
                                                            <Mic className="h-3 w-3" />
                                                            Voice
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-900 font-medium">
                                                    {review.display_name || "Anonymous"}
                                                </span>
                                                {review.is_anonymous && (
                                                    <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-gray-200">
                                                        Anon
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-gray-400">{formatIST(review.created_at)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5 text-amber-500">
                                                <span className="font-bold text-gray-900">{review.rating.toFixed(1)}</span>
                                                <div className="flex">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star
                                                            key={i}
                                                            className={clsx(
                                                                "h-3.5 w-3.5",
                                                                i < review.rating ? "fill-current" : "text-gray-200"
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={clsx(
                                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                                                {
                                                    "bg-yellow-100 text-yellow-800": review.approval_status === "pending",
                                                    "bg-green-100 text-green-800": review.approval_status === "approved",
                                                    "bg-red-100 text-red-800": review.approval_status === "rejected",
                                                }
                                            )}
                                        >
                                            {review.approval_status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => setSelectedReview(review)}
                                                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                                title="View Details"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            {review.approval_status === "pending" && (
                                                <>
                                                    <button
                                                        type="button"
                                                        disabled={isActionProcessing("approve", review.id)}
                                                        title="Approve"
                                                        className="rounded p-1.5 text-green-600 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        onClick={() => openActionDialog("approve", review)}
                                                    >
                                                        {isActionProcessing("approve", review.id) ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Check className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={isActionProcessing("reject", review.id)}
                                                        title="Reject"
                                                        className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                        onClick={() => openActionDialog("reject", review)}
                                                    >
                                                        {isActionProcessing("reject", review.id) ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <X className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </>
                                            )}
                                            <ProtectedAction permission={PERMISSIONS.REVIEWS_DELETE} hideWhenDisabled>
                                                <button
                                                    type="button"
                                                    disabled={isActionProcessing("delete", review.id)}
                                                    title="Delete"
                                                    className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                    onClick={() => openActionDialog("delete", review)}
                                                >
                                                    {isActionProcessing("delete", review.id) ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </ProtectedAction>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </AdminTableWrapper>

            {/* Detail Modal */}
            {selectedReview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                            <h3 className="text-lg font-semibold text-gray-900">Review Details</h3>
                            <button
                                onClick={() => setSelectedReview(null)}
                                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h4 className="font-medium text-gray-900 text-lg">{selectedReview.product_name}</h4>
                                    <p className="text-sm text-gray-500 flex items-center gap-2">
                                        By {selectedReview.display_name || "Anonymous"}
                                        {selectedReview.is_anonymous && (
                                            <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-gray-200">
                                                Anon
                                            </span>
                                        )}
                                        • {formatIST(selectedReview.created_at)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-full text-amber-700 font-bold">
                                    {selectedReview.rating} <Star className="h-4 w-4 fill-current" />
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                <h5 className="font-semibold text-gray-900 mb-1">{selectedReview.title}</h5>
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedReview.content}</p>
                            </div>

                            {selectedReview.review_media && selectedReview.review_media.length > 0 && (
                                <div className="space-y-3">
                                    <h5 className="font-medium text-gray-900 flex items-center gap-2">
                                        Attachments ({selectedReview.review_media.length})
                                    </h5>
                                    <div className="grid grid-cols-2 gap-4">
                                        {selectedReview.review_media.map((media: ReviewMedia) => {
                                            const publicUrl = buildPublicMediaUrl(media.file_path)
                                            return (
                                                <div key={media.id} className="relative rounded-lg overflow-hidden border border-gray-200 bg-black/5">
                                                    {media.file_type === 'image' && (
                                                        <img src={publicUrl} alt="review media" className="w-full h-auto object-contain max-h-60" />
                                                    )}
                                                    {media.file_type === 'video' && (
                                                        <video controls preload="none" className="w-full h-auto max-h-60">
                                                            <source src={publicUrl} />
                                                        </video>
                                                    )}
                                                    {media.file_type === 'audio' && (
                                                        <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 space-y-3">
                                                            <div className="flex items-center gap-2 text-indigo-700">
                                                                <Mic className="h-5 w-5" />
                                                                <span className="font-semibold text-sm">Voice Review</span>
                                                            </div>
                                                            <audio controls preload="none" className="w-full" style={{ height: '40px' }}>
                                                                <source src={publicUrl} />
                                                                Your browser does not support the audio element.
                                                            </audio>
                                                            <p className="text-xs text-gray-500 text-center">
                                                                Listen to the customer&apos;s voice review
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div >
                                </div >
                            )}
                        </div >

                        {actionError && !pendingAction && (
                            <div className="border-t border-red-100 bg-red-50 px-6 py-3 text-sm font-medium text-red-700">
                                {actionError}
                            </div>
                        )}

                        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex justify-end gap-3 shrink-0">
                            {selectedReview.approval_status === "pending" && (
                                <>
                                    <button
                                        type="button"
                                        disabled={hasProcessingState}
                                        onClick={() => runDetailAction("reject", selectedReview)}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isActionProcessing("reject", selectedReview.id) && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {isActionProcessing("reject", selectedReview.id)
                                            ? actionStatus === "refreshing" ? "Updating list..." : "Processing..."
                                            : "Reject"}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={hasProcessingState}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        onClick={() => runDetailAction("approve", selectedReview)}
                                    >
                                        {isActionProcessing("approve", selectedReview.id) && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {isActionProcessing("approve", selectedReview.id)
                                            ? actionStatus === "refreshing" ? "Updating list..." : "Processing..."
                                            : "Approve & Publish"}
                                    </button>
                                </>
                            )}
                            <ProtectedAction permission={PERMISSIONS.REVIEWS_DELETE} hideWhenDisabled>
                                <button
                                    type="button"
                                    disabled={hasProcessingState}
                                    onClick={() => openActionDialog("delete", selectedReview)}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 transition-all hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isActionProcessing("delete", selectedReview.id) && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {isActionProcessing("delete", selectedReview.id)
                                        ? actionStatus === "refreshing" ? "Updating list..." : "Deleting..."
                                        : "Delete"}
                                </button>
                            </ProtectedAction>
                        </div>
                    </div >
                </div >
            )}
            <ReviewActionDialog
                pendingAction={pendingAction}
                actionStatus={actionStatus}
                inFlightAction={inFlightAction}
                errorMessage={actionError}
                onClose={closeActionDialog}
                onConfirm={handleAction}
            />
            <BulkDeleteReviewsDialog
                isOpen={isBulkDeleteOpen}
                selectedCount={selectedCount}
                status={bulkDeleteStatus}
                errorMessage={bulkDeleteError}
                onClose={closeBulkDeleteDialog}
                onConfirm={handleBulkDelete}
            />
        </div >
    )
}

function BulkDeleteReviewsDialog({
    isOpen,
    selectedCount,
    status,
    errorMessage,
    onClose,
    onConfirm,
}: {
    isOpen: boolean
    selectedCount: number
    status: BulkDeleteStatus
    errorMessage: string | null
    onClose: () => void
    onConfirm: () => void
}) {
    const isProcessing = status !== "idle"
    const loadingText = status === "refreshing" ? "Updating list..." : "Deleting..."

    return (
        <Modal isOpen={isOpen} close={onClose} size="small">
            <div className="space-y-5">
                <Modal.Title>
                    <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-6 w-6" />
                        <span>Delete Selected Reviews</span>
                    </div>
                </Modal.Title>
                <Modal.Description>
                    <span className="leading-relaxed text-gray-600">
                        Delete {selectedCount} selected review{selectedCount === 1 ? "" : "s"}? This will also delete attached review media records and cannot be undone.
                    </span>
                </Modal.Description>
                {errorMessage && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                        {errorMessage}
                    </div>
                )}
                <Modal.Footer>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={onClose}
                        disabled={isProcessing}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={onConfirm}
                        disabled={isProcessing}
                    >
                        {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isProcessing ? loadingText : "Delete Reviews"}
                    </button>
                </Modal.Footer>
            </div>
        </Modal>
    )
}

function ReviewActionDialog({
    pendingAction,
    actionStatus,
    inFlightAction,
    errorMessage,
    onClose,
    onConfirm,
}: {
    pendingAction: PendingReviewAction
    actionStatus: ReviewActionStatus
    inFlightAction: PendingReviewAction
    errorMessage: string | null
    onClose: () => void
    onConfirm: () => void
}) {
    if (!pendingAction) {
        return null
    }

    const { action, review } = pendingAction
    const isDelete = action === "delete"
    const isProcessing =
        inFlightAction?.action === action &&
        inFlightAction.review.id === review.id &&
        actionStatus !== "idle"
    const title =
        action === "approve"
            ? "Approve Review"
            : action === "reject"
                ? "Reject Review"
                : "Delete Review"
    const confirmLabel =
        action === "approve"
            ? "Approve Review"
            : action === "reject"
                ? "Reject Review"
                : "Delete Review"
    const description =
        action === "approve"
            ? "This review will be published on the product page."
            : action === "reject"
                ? "This review will be marked as rejected and hidden from shoppers."
                : "This review and its media records will be deleted. This action cannot be undone."
    const loadingText =
        actionStatus === "refreshing" ? "Updating list..." : "Processing..."

    return (
        <Modal isOpen={Boolean(pendingAction)} close={onClose} size="small">
            <div className="space-y-5">
                <Modal.Title>
                    <div className={clsx("flex items-center gap-2", isDelete ? "text-red-600" : "text-gray-900")}>
                        {isDelete ? (
                            <AlertTriangle className="h-6 w-6" />
                        ) : action === "approve" ? (
                            <Check className="h-6 w-6 text-green-600" />
                        ) : (
                            <X className="h-6 w-6 text-red-600" />
                        )}
                        <span>{title}</span>
                    </div>
                </Modal.Title>
                <Modal.Description>
                    <span className="leading-relaxed text-gray-600">
                        {description}
                        <span className="mt-3 block rounded-lg bg-gray-50 px-3 py-2 text-gray-700">
                            <span className="font-semibold text-gray-900">{review.title}</span>
                            <span className="block text-xs text-gray-500">
                                {review.product_name || "Unknown Product"} by {review.display_name || "Anonymous"}
                            </span>
                        </span>
                    </span>
                </Modal.Description>
                {errorMessage && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                        {errorMessage}
                    </div>
                )}
                <Modal.Footer>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={onClose}
                        disabled={isProcessing}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={clsx(
                            "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50",
                            action === "approve"
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-red-600 hover:bg-red-700"
                        )}
                        onClick={onConfirm}
                        disabled={isProcessing}
                    >
                        {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isProcessing ? loadingText : confirmLabel}
                    </button>
                </Modal.Footer>
            </div>
        </Modal>
    )
}
