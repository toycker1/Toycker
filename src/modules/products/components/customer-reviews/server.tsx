import { getProductReviews } from "@/lib/actions/reviews"
import CustomerReviews from "./index"

type CustomerReviewsServerProps = {
  productId: string
  productHandle: string
  productThumbnail?: string | null
}

export default async function CustomerReviewsServer({
  productId,
  productHandle,
  productThumbnail,
}: CustomerReviewsServerProps) {
  const reviews = await getProductReviews(productId)

  return (
    <CustomerReviews
      productId={productId}
      productHandle={productHandle}
      reviews={reviews}
      productThumbnail={productThumbnail}
    />
  )
}
