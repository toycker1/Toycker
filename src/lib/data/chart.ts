"use server"

import { createClient } from "@lib/supabase/server"

export type ChartDataPoint = {
    date: string
    revenue: number
    orders: number
}

export type TimePeriod = "1w" | "2w" | "1m" | "1y"

const REPORT_TIME_ZONE = "Asia/Kolkata"
const CONFIRMED_REVENUE_STATUSES = ["order_placed", "accepted", "shipped", "delivered"] as const
const IST_OFFSET_MINUTES = 330

type ReportDateParts = {
    year: number
    month: number
    day: number
}

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
})

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    month: "short",
    day: "numeric",
})

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    month: "short",
    year: "2-digit",
})

function getReportDateParts(date: Date): ReportDateParts {
    const parts = dateKeyFormatter.formatToParts(date)
    const getPart = (type: "year" | "month" | "day") => {
        const value = parts.find((part) => part.type === type)?.value
        return Number(value || 0)
    }

    return {
        year: getPart("year"),
        month: getPart("month"),
        day: getPart("day"),
    }
}

function getDayKey(date: Date) {
    const { year, month, day } = getReportDateParts(date)
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function getMonthKey(date: Date) {
    const { year, month } = getReportDateParts(date)
    return `${year}-${String(month).padStart(2, "0")}`
}

function getIstMidnightUtcDate(parts: ReportDateParts) {
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, -IST_OFFSET_MINUTES))
}

function getIstMonthStartUtcDate(year: number, month: number) {
    return new Date(Date.UTC(year, month - 1, 1, 0, -IST_OFFSET_MINUTES))
}

export async function getChartData(period: TimePeriod): Promise<ChartDataPoint[]> {
    const supabase = await createClient()
    const now = new Date()
    const todayParts = getReportDateParts(now)
    const todayStart = getIstMidnightUtcDate(todayParts)
    let startDate = new Date(todayStart)
    let groupBy: "day" | "month" = "day"

    switch (period) {
        case "1w":
            startDate.setUTCDate(todayStart.getUTCDate() - 7)
            break
        case "2w":
            startDate.setUTCDate(todayStart.getUTCDate() - 14)
            break
        case "1m":
            startDate.setUTCDate(todayStart.getUTCDate() - 30)
            break
        case "1y":
            startDate = getIstMonthStartUtcDate(todayParts.year, todayParts.month - 11)
            groupBy = "month"
            break
    }

    const { data: orders, error } = await supabase
        .from("orders")
        .select("created_at, total_amount")
        .gte("created_at", startDate.toISOString())
        // Pending orders are not confirmed revenue yet.
        .in("status", [...CONFIRMED_REVENUE_STATUSES])
        .order("created_at", { ascending: true })

    if (error || !orders) {
        console.error("Error fetching chart data:", error)
        return []
    }

    const dataMap = new Map<string, { revenue: number; orders: number; dateInfo: Date }>()

    // Initialize map with all intervals to ensure no gaps
    if (groupBy === "day") {
        for (let d = new Date(startDate); d <= now; d.setUTCDate(d.getUTCDate() + 1)) {
            const key = getDayKey(d)
            dataMap.set(key, { revenue: 0, orders: 0, dateInfo: new Date(d) })
        }
    } else {
        // Month grouping
        for (let i = 0; i < 12; i++) {
            const d = getIstMonthStartUtcDate(todayParts.year, todayParts.month - 11 + i)
            if (d > now) break
            const key = getMonthKey(d)
            dataMap.set(key, { revenue: 0, orders: 0, dateInfo: d })
        }
    }

    orders.forEach((order) => {
        const d = new Date(order.created_at)
        const key = groupBy === "day" ? getDayKey(d) : getMonthKey(d)

        const current = dataMap.get(key)
        if (current) {
            current.revenue += order.total_amount
            current.orders += 1
        }
    })

    // Format keys for display
    const result = Array.from(dataMap.values()).map(item => {
        let displayDate = ""
        if (groupBy === "day") {
            displayDate = dayLabelFormatter.format(item.dateInfo)
        } else {
            displayDate = monthLabelFormatter.format(item.dateInfo)
        }

        return {
            date: displayDate,
            revenue: item.revenue,
            orders: item.orders
        }
    })

    return result
}
