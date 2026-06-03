"use client"
import { useEffect, useRef } from "react"
import { Chart, type ChartConfiguration } from "chart.js/auto"

export function useChart(config: ChartConfiguration | null) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  useEffect(() => {
    if (!ref.current || !config) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(ref.current, config)
    return () => { chartRef.current?.destroy() }
  }, [config])
  return ref
}
