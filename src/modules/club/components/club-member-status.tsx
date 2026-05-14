"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ShoppingBag, Trophy } from "lucide-react"

import { Button } from "@modules/common/components/button"
import { useLayoutData } from "@modules/layout/context/layout-data-context"

type CustomerClubSummary = {
  total_club_savings?: number
}

type ClubMemberStatusProps = {
  discountPercentage: number
  formattedMinPurchase: string
}

export default function ClubMemberStatus({
  discountPercentage,
  formattedMinPurchase,
}: ClubMemberStatusProps) {
  const { customer } = useLayoutData()
  const [clubSummary, setClubSummary] = useState<CustomerClubSummary | null>(null)

  useEffect(() => {
    let ignore = false

    if (!customer?.is_club_member) {
      setClubSummary(null)
      return
    }

    const loadClubSummary = async () => {
      try {
        const response = await fetch("/api/customer", {
          cache: "no-store",
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as CustomerClubSummary

        if (!ignore) {
          setClubSummary(payload)
        }
      } catch (error) {
        console.warn("Failed to load club member summary", error)
      }
    }

    void loadClubSummary()

    return () => {
      ignore = true
    }
  }, [customer?.is_club_member])

  if (customer?.is_club_member) {
    return (
      <StatusShell>
        <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg transform rotate-[-10deg]">
          <Trophy className="w-12 h-12 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-slate-900 mb-2">You are a Club Member!</h3>
          <p className="text-slate-600 mb-1">
            You&apos;re enjoying <strong>{discountPercentage}% off</strong> on all products.
          </p>
          {clubSummary?.total_club_savings ? (
            <p className="text-emerald-700 font-medium">
              Total savings so far: {new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
              }).format(clubSummary.total_club_savings)}
            </p>
          ) : null}
        </div>
        <Link href="/store">
          <Button className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">
            Browse Deals
          </Button>
        </Link>
      </StatusShell>
    )
  }

  return (
    <StatusShell>
      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md border-4 border-[#F6E36C]">
        <ShoppingBag className="w-10 h-10 text-slate-400" />
      </div>
      <div className="flex-1">
        <h3 className="text-2xl font-bold text-slate-900 mb-2">How to Join?</h3>
        <p className="text-slate-600">
          Simply make a single purchase of <span className="font-bold text-slate-900">{formattedMinPurchase}</span> or more.
          Your membership will be activated automatically!
        </p>
      </div>
      <Link href="/store">
        <Button variant="secondary" className="shrink-0">
          Shop Now
        </Button>
      </Link>
    </StatusShell>
  )
}

function StatusShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
      {children}
    </div>
  )
}
