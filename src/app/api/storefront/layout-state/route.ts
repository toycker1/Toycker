import { NextResponse } from "next/server"

import { retrieveLayoutState } from "@lib/data/layout-state"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { customer, cart } = await retrieveLayoutState()

    return NextResponse.json({ customer, cart })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load layout state"
    return NextResponse.json({ message }, { status: 500 })
  }
}
