"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@lib/supabase/client"

type RealtimeOrderManagerProps = {
    orderId: string
}

export const RealtimeOrderManager = ({ orderId }: RealtimeOrderManagerProps) => {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])

    useEffect(() => {
        const channel = supabase
            .channel(`order-manager-${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `id=eq.${orderId}`,
                },
                () => {
                    router.refresh()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [orderId, router, supabase])

    return null
}
