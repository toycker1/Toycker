import Image from "next/image"
import { Package, Clock, CheckCircle2, Truck } from "lucide-react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { AccountOrderSummary } from "@lib/data/orders"
import { cn } from "@lib/util/cn"
import { fixUrl } from "@lib/util/images"

type OrderCardProps = {
  order: AccountOrderSummary
}

const OrderCard = ({ order }: OrderCardProps) => {
  // Get order status
  const getStatusInfo = () => {
    const status = order.status || "pending"
    const fulfillmentStatus = order.fulfillment_status || "not_fulfilled"

    // Explicitly handle Cancelled/Failed first as they take priority
    if (status.toLowerCase() === "cancelled" || order.payment_status === "failed") {
      return {
        label: "Cancelled",
        icon: Package,
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        iconColor: "text-red-600",
      }
    }

    switch (fulfillmentStatus.toLowerCase()) {
      case "fulfilled":
      case "delivered":
        return {
          label: "Delivered",
          icon: CheckCircle2,
          bgColor: "bg-green-50",
          textColor: "text-green-700",
          iconColor: "text-green-600",
        }
      case "shipped":
        return {
          label: "Shipped",
          icon: Truck,
          bgColor: "bg-blue-50",
          textColor: "text-blue-700",
          iconColor: "text-blue-600",
        }
      case "pending":
      case "not_fulfilled":
        return {
          label: status.toLowerCase() === "pending" ? "Processing" : (status.charAt(0).toUpperCase() + status.slice(1)),
          icon: Clock,
          bgColor: "bg-amber-50",
          textColor: "text-amber-700",
          iconColor: "text-amber-600",
        }
      default:
        return {
          label: status.charAt(0).toUpperCase() + status.slice(1),
          icon: Package,
          bgColor: "bg-gray-50",
          textColor: "text-gray-700",
          iconColor: "text-gray-600",
        }
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon
  const firstItemTitle = order.first_item_title?.trim() || "Order items"
  const itemCountLabel = getOrderItemCountLabel(order.item_count)
  const thumbnailUrl = order.first_item_thumbnail
    ? fixUrl(order.first_item_thumbnail)
    : null

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
      data-testid="order-card"
    >
      {/* Header - Order ID and Status */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Order</p>
          <p className="text-lg font-semibold text-gray-900">
            #<span data-testid="order-display-id">{order.display_id}</span>
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
            statusInfo.bgColor,
            statusInfo.textColor
          )}
        >
          <StatusIcon className={cn("h-4 w-4", statusInfo.iconColor)} />
          <span>{statusInfo.label}</span>
        </div>
      </div>

      {/* Lightweight product context from the order summary view */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={firstItemTitle}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              <Package className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 line-clamp-2">
            {firstItemTitle}
          </p>
          <p className="text-xs text-gray-500">{itemCountLabel}</p>
        </div>
      </div>

      {/* Order Details - Date, Amount, Details */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Date</p>
          <p
            className="text-sm font-medium text-gray-900"
            data-testid="order-created-at"
          >
            {new Date(order.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Total</p>
          <p
            className="text-sm font-semibold text-gray-900"
            data-testid="order-amount"
          >
            {convertToLocale({
              amount: order.total,
              currency_code: order.currency_code,
            })}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Items</p>
          <p className="text-sm font-medium text-gray-900">
            {itemCountLabel}
          </p>
        </div>
      </div>

      {/* View Details Button */}
      <div className="flex justify-end pt-4 border-t border-gray-100">
        <LocalizedClientLink href={`/account/orders/details/${order.id}`}>
          <button
            data-testid="order-details-link"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150"
          >
            View Details
          </button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

const getOrderItemCountLabel = (count: number) => {
  const safeCount = Math.max(0, count)

  return safeCount === 1 ? "1 item" : `${safeCount} items`
}

export default OrderCard
