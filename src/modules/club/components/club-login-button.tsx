"use client"

import Link from "next/link"

import { Button } from "@modules/common/components/button"
import { useLayoutData } from "@modules/layout/context/layout-data-context"

export default function ClubLoginButton() {
  const { customer, loading } = useLayoutData()

  if (loading || customer) {
    return null
  }

  return (
    <Link href="/account">
      <Button className="h-14 px-10 rounded-full text-lg" variant="secondary">
        Log In
      </Button>
    </Link>
  )
}
