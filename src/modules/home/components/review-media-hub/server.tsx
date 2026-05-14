import { listHomeReviewsStorefront } from "@/lib/actions/home-reviews"
import ReviewMediaHub from "./index"

export default async function ReviewMediaHubServer() {
  const homeReviews = await listHomeReviewsStorefront()

  if (homeReviews.length === 0) {
    return null
  }

  return <ReviewMediaHub reviews={homeReviews} />
}
