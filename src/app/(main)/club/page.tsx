import { Metadata } from "next"
import { getClubSettings } from "@lib/data/club"
import { Button } from "@modules/common/components/button"
import Link from "next/link"
import { Check, Sparkles, Trophy } from "lucide-react"
import ClubLoginButton from "@modules/club/components/club-login-button"
import ClubMemberStatus from "@modules/club/components/club-member-status"

export const metadata: Metadata = {
    title: "Toycker Club | Unlock Exclusive Savings",
    description: "Join the Toycker Club and get exclusive discounts on every purchase.",
}

export const revalidate = 300

export default async function ClubPage() {
    const settings = await getClubSettings()
    const minPurchaseAmount = settings.min_purchase_amount
    const discountPercentage = settings.discount_percentage

    const formattedMinPurchase = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(minPurchaseAmount)

    return (
        <div className="w-full">
            {/* Hero Section */}
            <div className="relative bg-gradient-to-b from-[#FFF5F5] to-white py-20 lg:py-28 overflow-hidden">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-[#FFE5E5] rounded-full blur-3xl opacity-50" />
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-[#F6E36C] rounded-full blur-3xl opacity-30" />

                <div className="content-container relative z-10 flex flex-col items-center text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-emerald-100 mb-8">
                        <Sparkles className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-semibold text-emerald-800">The most rewarding club for parents</span>
                    </div>

                    <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6 font-display">
                        Join the <span className="text-[#E7353A]">Toycker Club</span>
                    </h1>

                    <p className="text-lg lg:text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed">
                        Unlock a permanent <span className="font-bold text-slate-900">{discountPercentage}% discount</span> on everything in our store.
                        No monthly fees, just pure savings for our loyal customers.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                        <Link href="/store">
                            <Button className="h-14 px-10 rounded-full text-lg" variant="primary">
                                Start Shopping
                            </Button>
                        </Link>
                        <ClubLoginButton />
                    </div>
                </div>
            </div>

            {/* Member Status / Eligibility Section */}
            <div className="py-16 bg-white border-y border-slate-100">
                <div className="content-container">
                    <div className="max-w-4xl mx-auto bg-slate-50 rounded-[2rem] p-8 lg:p-12 relative overflow-hidden">
                        <ClubMemberStatus
                            discountPercentage={discountPercentage}
                            formattedMinPurchase={formattedMinPurchase}
                        />
                    </div>
                </div>
            </div>

            {/* Benefits Grid */}
            <div className="py-20 bg-white">
                <div className="content-container">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">Why you&apos;ll love it</h2>
                        <p className="text-slate-500 text-lg">More than just a discount.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <BenefitCard
                            icon={<Sparkles className="w-6 h-6 text-[#E7353A]" />}
                            title={`${discountPercentage}% Automatic Discount`}
                            description="No coupons needed. As soon as you log in, you see your special Club Price."
                        />
                        <BenefitCard
                            icon={<Check className="w-6 h-6 text-[#E7353A]" />}
                            title="Lifetime Membership"
                            description="Once you join, you're in forever. No renewals, no hidden fees."
                        />
                        <BenefitCard
                            icon={<Trophy className="w-6 h-6 text-[#E7353A]" />}
                            title="Early Access"
                            description="Be the first to know about new arrivals and exclusive flash sales."
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

function BenefitCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="p-8 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-[#FFF5F5] rounded-2xl flex items-center justify-center mb-6">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
            <p className="text-slate-500 leading-relaxed">{description}</p>
        </div>
    )
}
