"use client"

import dynamic from "next/dynamic"
import type { ChartDataPoint } from "@/lib/data/chart"

const ReportsChart = dynamic(() => import("./reports-chart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50">
      <p className="text-sm text-gray-500">Loading report...</p>
    </div>
  ),
})

type ReportsChartLoaderProps = {
  initialData: ChartDataPoint[]
}

export default function ReportsChartLoader({
  initialData,
}: ReportsChartLoaderProps) {
  return <ReportsChart initialData={initialData} />
}
