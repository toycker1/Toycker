"use server"

import { createClient } from "@/lib/supabase/server"
import { PaymentProvider } from "@/lib/supabase/types"

const ONLINE_GATEWAY_IDS = ["pp_payu_payu", "pp_easebuzz_easebuzz"] as const

export async function getOnlinePaymentGateways(): Promise<{ id: string; name: string; is_active: boolean }[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("payment_providers")
    .select("id, name, is_active")
    .in("id", ONLINE_GATEWAY_IDS)

  if (error) {
    console.error("Error fetching online payment gateways:", error.message)
    return []
  }

  return (data as Pick<PaymentProvider, "id" | "name" | "is_active">[]).map((row) => ({
    id: row.id,
    name: row.name,
    is_active: row.is_active,
  }))
}

export const listCartPaymentMethods = async (_regionId: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("payment_providers")
    .select("id, name, description")
    .eq("is_active", true)

  if (error) {
    console.error("Error fetching payment methods:", error.message)
    // Fallback if DB query fails
    return [
      {
        id: "pp_easebuzz_easebuzz",
        name: "Easebuzz",
      },
    ]
  }

  return data.map((method: Partial<PaymentProvider>) => ({
    id: method.id!,
    name: method.name!,
  }))
}