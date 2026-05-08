import type { ShippingOption } from "@/lib/supabase/types"

export type LayoutCustomer = {
  id: string
  first_name: string | null
  is_club_member: boolean
}

export type LayoutCartSummary = {
  id: string
  user_id: string | null
  region_id: string | null
  currency_code: string
  updated_at: string | null
  item_count: number
}

export type LayoutState = {
  customer: LayoutCustomer | null
  cart: LayoutCartSummary | null
}

export type ShippingOptionsState = {
  shippingOptions: ShippingOption[]
  regionId: string | null
}
