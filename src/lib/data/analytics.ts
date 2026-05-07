import { createClient } from "@lib/supabase/server"

export type SalesDataPoint = {
    date: string
    sales: number
}

export type TopProduct = {
    id: string
    title: string
    thumbnail: string | null
    price: number
    currency_code: string
    total_quantity: number
}

const TOP_PRODUCTS_ORDER_SAMPLE_LIMIT = 100

type OrderItemSummary = {
    product_id?: string | null
    quantity?: number | null
}

function isOrderItemSummary(value: unknown): value is OrderItemSummary {
    return typeof value === "object" && value !== null
}

type TopProductDisplayRow = {
    id: string
    name: string
    thumbnail: string | null
    image_url: string | null
    price: number
    currency_code: string
}


export async function getTopProducts(limit: number = 5): Promise<TopProduct[]> {
    const supabase = await createClient()

    const { data: orders, error } = await supabase
        .from("orders")
        .select("items")
        .neq("status", "cancelled")
        .neq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(TOP_PRODUCTS_ORDER_SAMPLE_LIMIT)

    if (error || !orders) {
        console.error("Error fetching top products:", error)
        return []
    }

    // Aggregate in memory
    const productStats = new Map<string, number>()

    orders.forEach(order => {
        const items = Array.isArray(order.items)
            ? order.items.filter(isOrderItemSummary)
            : []

        items.forEach((item) => {
            if (!item.product_id) return

            const qty = item.quantity || 0
            productStats.set(item.product_id, (productStats.get(item.product_id) || 0) + qty)
        })
    })

    const sortedStats = Array.from(productStats.entries())
        .map(([id, quantity]) => ({ id, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, limit)

    const productIds = sortedStats.map((product) => product.id)

    if (productIds.length === 0) {
        return []
    }

    const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, thumbnail, image_url, price, currency_code")
        .in("id", productIds)

    if (productsError || !products) {
        console.error("Error fetching top product details:", productsError)
        return []
    }

    const productMap = new Map(
        ((products || []) as TopProductDisplayRow[]).map((product) => [product.id, product])
    )

    return sortedStats
        .map(({ id, quantity }) => {
            const product = productMap.get(id)

            if (!product) {
                return null
            }

            return {
                id,
                title: product.name,
                thumbnail: product.thumbnail || product.image_url,
                price: product.price,
                currency_code: product.currency_code,
                total_quantity: quantity
            }
        })
        .filter((product): product is TopProduct => product !== null)
}

export type DashboardStats = {
    revenue: {
        value: number
        change: number
        trend: 'up' | 'down' | 'neutral'
    }
    orders: {
        value: number
        change: number
        trend: 'up' | 'down' | 'neutral'
    }
    products: {
        value: number
        lowStock: number
        outOfStock: number
    }
    customers: {
        value: number
        newThisMonth: number
    }
}

export async function getDashboardStats(): Promise<DashboardStats> {
    const supabase = await createClient()
    const now = new Date()

    // Date Ranges
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // 1. Revenue & Orders (Current Month vs Last Month)
    // We fetch all orders from startOfLastMonth to now to minimize queries, then split in JS.
    // This is efficient enough for a prototype and small-medium scale.

    const { data: recentOrders, error: ordersError } = await supabase
        .from("orders")
        .select("created_at, total_amount, id")
        .gte("created_at", startOfLastMonth.toISOString())
        .neq("status", "cancelled")
        .neq("status", "failed")

    if (ordersError) {
        console.error("Error fetching stats:", ordersError)
        // Return empty/zero stats on error
        return {
            revenue: { value: 0, change: 0, trend: 'neutral' },
            orders: { value: 0, change: 0, trend: 'neutral' },
            products: { value: 0, lowStock: 0, outOfStock: 0 },
            customers: { value: 0, newThisMonth: 0 }
        }
    }

    let revenueCurrent = 0
    let revenueLast = 0
    let ordersCurrent = 0
    let ordersLast = 0

    const currentMonthISO = startOfCurrentMonth.toISOString()

    recentOrders.forEach(order => {
        if (order.created_at >= currentMonthISO) {
            revenueCurrent += order.total_amount
            ordersCurrent += 1
        } else {
            revenueLast += order.total_amount
            ordersLast += 1
        }
    })

    // Calculate trends
    const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0
        return ((current - previous) / previous) * 100
    }

    const revenueChange = calculateChange(revenueCurrent, revenueLast)
    const ordersChange = calculateChange(ordersCurrent, ordersLast)

    // 2. Active Products & Low Stock
    // Use head: true (count) for fast counting
    const { count: activeProducts } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")

    // 3. Customers
    // Total
    const { count: totalCustomers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })

    // New this month (Reuse simple query or count)
    // For precise "New This Month", valid query:
    const { count: newCustomers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfCurrentMonth.toISOString())


    // 4. Low Stock & Out of Stock (similar to getLowStockStats but in analytics context)
    const threshold = 5
    const [{ count: lowStockProducts }, { count: outOfStockProducts }, { count: lowStockVariants }, { count: outOfStockVariants }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }).lte("stock_count", threshold).gt("stock_count", 0),
        supabase.from("products").select("*", { count: "exact", head: true }).eq("stock_count", 0),
        supabase.from("product_variants").select("*", { count: "exact", head: true }).lte("inventory_quantity", threshold).gt("inventory_quantity", 0),
        supabase.from("product_variants").select("*", { count: "exact", head: true }).eq("inventory_quantity", 0)
    ])

    return {
        revenue: {
            value: revenueCurrent, // in cents
            change: revenueChange,
            trend: revenueChange > 0 ? 'up' : revenueChange < 0 ? 'down' : 'neutral'
        },
        orders: {
            value: ordersCurrent,
            change: ordersChange,
            trend: ordersChange > 0 ? 'up' : ordersChange < 0 ? 'down' : 'neutral'
        },
        products: {
            value: activeProducts || 0,
            lowStock: (lowStockProducts || 0) + (lowStockVariants || 0),
            outOfStock: (outOfStockProducts || 0) + (outOfStockVariants || 0)
        },
        customers: {
            value: totalCustomers || 0,
            newThisMonth: newCustomers || 0
        }
    }
}
