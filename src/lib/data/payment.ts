"use server"

import { createClient } from "@/lib/supabase/server"
import { PartialPaymentRule, PaymentProvider } from "@/lib/supabase/types"

const ONLINE_GATEWAY_IDS = [
  "pp_payu_payu",
  "pp_easebuzz_easebuzz",
] as const

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
    .select("id, name, description, partial_payment_percentage")
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

  const methods = (data as Pick<
    PaymentProvider,
    "id" | "name" | "description" | "partial_payment_percentage"
  >[]).map((method) => ({
    id: method.id,
    name: method.name,
    description: method.description,
    partial_payment_percentage: method.partial_payment_percentage ?? null,
  }))

  const partialPaymentMethod = methods.find(
    (method) => method.id === "pp_easebuzz_partial_payment"
  )

  if (!partialPaymentMethod) {
    return methods
  }

  const { data: rules, error: rulesError } = await supabase
    .from("partial_payment_rules")
    .select("id, payment_provider_id, min_order_amount, max_order_amount, advance_percentage, is_active, sort_order, created_at, updated_at")
    .eq("payment_provider_id", "pp_easebuzz_partial_payment")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("min_order_amount", { ascending: true })

  if (rulesError) {
    console.error("Error fetching partial payment rules:", rulesError.message)
    return methods
  }

  return methods.map((method) =>
    method.id === "pp_easebuzz_partial_payment"
      ? {
          ...method,
          partial_payment_rules: (rules ?? []) as PartialPaymentRule[],
        }
      : method
  )
}
