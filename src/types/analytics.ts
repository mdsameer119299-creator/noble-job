export interface ChartDataPoint { label: string; value: number }
export interface PerformancePoint { date: string; applications: number }
export interface AnalyticsSummary {
  performanceTrend: PerformancePoint[]
  sources: ChartDataPoint[]; categories: ChartDataPoint[]
  funnel: ChartDataPoint[]; timeToHireDays: number
  conversionRate: number; avgApplicationsPerJob: number
}
