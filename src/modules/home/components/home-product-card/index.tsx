import Image from "next/image"
import Link from "next/link"

import type { HomeProductCard as HomeProductCardType } from "@modules/home/lib/home-product-cards"
import HomeProductCardActions from "./home-product-card-actions"

type HomeProductCardProps = {
  product: HomeProductCardType
  clubDiscountPercentage?: number
  imageSizes?: string
}

const formatAmount = (amount: number, currencyCode: string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode || "INR",
    minimumFractionDigits: 2,
  }).format(amount)

const getCompareAtPrice = (product: HomeProductCardType): number | null => {
  const metadataCompareAt = product.metadata?.compare_at_price

  if (typeof metadataCompareAt === "number" && Number.isFinite(metadataCompareAt)) {
    return metadataCompareAt
  }

  if (typeof metadataCompareAt === "string") {
    const parsed = Number(metadataCompareAt)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const getLowestPrice = (product: HomeProductCardType) => {
  if (product.variants.length === 0) {
    return {
      price: product.price,
      compareAtPrice: getCompareAtPrice(product),
    }
  }

  const lowestVariant = [...product.variants].sort((a, b) => a.price - b.price)[0]

  return {
    price: lowestVariant.price,
    compareAtPrice: lowestVariant.compare_at_price ?? getCompareAtPrice(product),
  }
}

export default function HomeProductCard({
  product,
  clubDiscountPercentage = 0,
  imageSizes = "(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 20vw",
}: HomeProductCardProps) {
  const imageSrc = product.thumbnail ?? product.image_url
  const currencyCode = product.currency_code || "INR"
  const { price, compareAtPrice } = getLowestPrice(product)
  const clubPrice =
    clubDiscountPercentage > 0
      ? Math.round(price * (1 - clubDiscountPercentage / 100))
      : null
  const isDiscounted = Boolean(compareAtPrice && compareAtPrice > price)
  const hasVariants = product.variants.length > 0
  const variantId = product.variants[0]?.id ?? null
  const discountPercentage =
    compareAtPrice && compareAtPrice > price
      ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
      : null

  return (
    <Link
      href={`/products/${product.handle}`}
      prefetch={false}
      className="group block h-full"
    >
      <article className="flex h-full flex-col">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-gray-100">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={product.name}
              fill
              draggable={false}
              quality={95}
              sizes={imageSizes}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="h-full w-full bg-gray-100" aria-hidden="true" />
          )}
          <HomeProductCardActions
            productId={product.id}
            productHandle={product.handle}
            productTitle={product.name}
            variantId={variantId}
            hasVariants={hasVariants}
          />
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-black/0 transition-colors duration-300 group-hover:bg-black/5" />
        </div>

        <div className="mt-3 flex flex-1 flex-col gap-1">
          <h3 className="line-clamp-1 text-sm font-semibold tracking-tight text-slate-900 transition-colors group-hover:text-primary md:text-base">
            {product.name}
          </h3>
          <div className="mt-auto flex flex-col gap-1 leading-tight">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span
                className={`text-lg font-bold ${
                  isDiscounted ? "text-[#E7353A]" : "text-slate-900"
                }`}
              >
                {formatAmount(price, currencyCode)}
              </span>
              {isDiscounted && compareAtPrice && (
                <span className="whitespace-nowrap text-xs text-gray-400 line-through">
                  {formatAmount(compareAtPrice, currencyCode)}
                </span>
              )}
              {discountPercentage && (
                <span className="text-sm font-bold uppercase tracking-tight text-emerald-600">
                  [{discountPercentage}% OFF]
                </span>
              )}
            </div>
            {clubPrice && (
              <span className="font-bold text-emerald-700">
                Club Price: {formatAmount(clubPrice, currencyCode)}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
