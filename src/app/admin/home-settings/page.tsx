import { Metadata } from "next"
import { listHomeBannersAdmin } from "@/lib/actions/home-banners"
import { listExclusiveCollectionsAdmin } from "@/lib/actions/home-exclusive-collections"
import { listHomeReviewsAdmin } from "@/lib/actions/home-reviews"
import HomeSettingsClient from "./home-settings-client"

export const metadata: Metadata = {
    title: "Home Settings | Admin",
    description: "Manage homepage banners, exclusive collections, and featured reviews",
}

export default async function HomeSettingsPage() {
    // Fetch data on server
    const { banners } = await listHomeBannersAdmin()
    const { collections } = await listExclusiveCollectionsAdmin()
    const { reviews: homeReviews } = await listHomeReviewsAdmin()

    return (
        <HomeSettingsClient
            banners={banners}
            collections={collections}
            homeReviews={homeReviews}
        />
    )
}
