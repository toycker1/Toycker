"use client"

import { useMemo, useState, useTransition } from "react"
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from "recharts"
import { ChartDataPoint, getChartData, TimePeriod } from "@/lib/data/chart"
import { convertToLocale } from "@/lib/util/money"

type Props = {
    initialData: ChartDataPoint[]
}

const formatRevenue = (amount: number) =>
    convertToLocale({
        amount,
        currency_code: "inr",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })

const formatOrderCount = (count: number) =>
    new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 0,
    }).format(count)

const periodLabelMap: Record<TimePeriod, string> = {
    "1w": "1 Week",
    "2w": "2 Weeks",
    "1m": "Monthly",
    "1y": "Yearly",
}

export default function ReportsChart({ initialData }: Props) {
    const [data, setData] = useState<ChartDataPoint[]>(initialData)
    const [period, setPeriod] = useState<TimePeriod>("1m")
    const [isPending, startTransition] = useTransition()

    const handlePeriodChange = (newPeriod: TimePeriod) => {
        setPeriod(newPeriod)
        startTransition(async () => {
            const newData = await getChartData(newPeriod)
            setData(newData)
        })
    }

    const tabs: { label: string; value: TimePeriod }[] = [
        { label: "1 Week", value: "1w" },
        { label: "2 Weeks", value: "2w" },
        { label: "Monthly", value: "1m" },
        { label: "Yearly", value: "1y" },
    ]

    // Optional: check if data is empty
    const isEmpty = data.length === 0 || data.every(d => d.revenue === 0 && d.orders === 0)
    const totals = useMemo(
        () =>
            data.reduce(
                (currentTotals, item) => ({
                    orders: currentTotals.orders + item.orders,
                    revenue: currentTotals.revenue + item.revenue,
                }),
                { orders: 0, revenue: 0 }
            ),
        [data]
    )

    return (
        <div className="flex h-full min-h-[430px] w-full flex-col gap-3">
            <div className="flex flex-col gap-3 border-b border-gray-100 pb-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-4">
                        <SummaryMetric label="Total Orders" value={formatOrderCount(totals.orders)} dotClassName="bg-[#F59E0B]" />
                        <SummaryMetric label="Total Revenue" value={formatRevenue(totals.revenue)} dotClassName="bg-[#4F46E5]" />
                    </div>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.value}
                            onClick={() => handlePeriodChange(tab.value)}
                            disabled={isPending}
                            className={`
                px-3 py-1 text-xs font-medium rounded-md transition-all
                ${period === tab.value
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                }
                ${isPending ? "opacity-70 cursor-wait" : ""}
              `}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className={`relative min-h-[340px] flex-1 w-full ${isPending ? "opacity-50 transition-opacity" : "opacity-100"}`}>
                {isEmpty && !isPending && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/50 z-10 rounded-lg border border-dashed border-gray-200">
                        <p className="text-sm text-gray-500">No data for {periodLabelMap[period]}</p>
                    </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 8, right: 32, left: 16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#6B7280", fontSize: 11 }}
                            tickMargin={10}
                        />
                        {/* Left YAxis for revenue in rupees. */}
                        <YAxis
                            yAxisId="left"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#6B7280", fontSize: 11 }}
                            tickFormatter={(value) => formatRevenue(Number(value))}
                            width={76}
                        />
                        {/* Right YAxis for whole-number order counts. */}
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#9CA3AF", fontSize: 11 }}
                            tickFormatter={(value) => formatOrderCount(Math.round(Number(value)))}
                            allowDecimals={false}
                            width={36}
                        />
                        <Tooltip
                            cursor={{ fill: "#F3F4F6", opacity: 0.5 }}
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg min-w-[150px]">
                                            <p className="text-xs text-gray-500 mb-2 font-medium">{label}</p>

                                            {payload.map((entry) => {
                                                const dataKey = String(entry.dataKey ?? entry.name ?? "")
                                                const value = typeof entry.value === "number" ? entry.value : Number(entry.value || 0)
                                                const labelText = dataKey === "revenue" ? "Revenue" : "Orders"

                                                return (
                                                <div key={dataKey} className="flex justify-between items-center gap-4 mb-1 last:mb-0 text-xs">
                                                    <span style={{ color: entry.color }} className="font-medium">
                                                        {labelText}
                                                    </span>
                                                    <span className="font-bold text-gray-900">
                                                        {dataKey === "revenue"
                                                            ? formatRevenue(value)
                                                            : formatOrderCount(value)}
                                                    </span>
                                                </div>
                                                )
                                            })}
                                        </div>
                                    )
                                }
                                return null
                            }}
                        />
                        <Legend
                            verticalAlign="top"
                            height={36}
                            iconType="circle"
                            formatter={(value) => <span className="text-xs font-medium text-gray-600 ml-1">{value === "revenue" ? "Revenue" : "Orders"}</span>}
                        />
                        <Bar
                            yAxisId="left"
                            dataKey="revenue"
                            fill="#4F46E5"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                            name="revenue"
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="orders"
                            stroke="#F59E0B"
                            strokeWidth={2}
                            dot={{ r: 3, fill: "#F59E0B", strokeWidth: 0 }}
                            activeDot={{ r: 5, strokeWidth: 0 }}
                            name="orders"
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

function SummaryMetric({
    label,
    value,
    dotClassName,
}: {
    label: string
    value: string
    dotClassName: string
}) {
    return (
        <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${dotClassName}`} aria-hidden="true" />
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="text-sm font-semibold text-gray-900">{value}</p>
        </div>
    )
}
