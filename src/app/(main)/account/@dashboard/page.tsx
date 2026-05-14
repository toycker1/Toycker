import { Metadata } from "next"
import Overview from "@modules/account/components/overview"
import { listOrders } from "@lib/data/orders"
import { retrieveCustomer } from "@lib/data/customer"
import { getUserReviewCount } from "@lib/actions/reviews"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Account",
  description: "Overview of your account.",
}

export default async function DashboardPage() {
  const [customer, orders, reviewsCount] = await Promise.all([
    retrieveCustomer(),
    listOrders(),
    getUserReviewCount(),
  ])

  if (!customer) {
    notFound()
  }

  return <Overview customer={customer} orders={orders} reviewsCount={reviewsCount} />
}
