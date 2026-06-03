interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  height?: number
  label?: string
}

export function ProgressBar({ value, max = 100, color = '#1847d4', height = 8, label }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs font-semibold text-t3 mb-1">
          <span>{label}</span><span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className="w-full bg-gray-100 rounded-full overflow-hidden" style={{ height }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}
