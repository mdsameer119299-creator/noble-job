import type { JobStatus } from "@/types/job"
import { JOB_STATUS_META } from "@/lib/config/jobStrategy"

const STYLES: Record<"green" | "blue" | "gray", { bg: string; color: string; border: string }> = {
  green: { bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
  blue: { bg: "#eff6ff", color: "#1847d4", border: "#bfdbfe" },
  gray: { bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
}

interface JobStatusBadgeProps {
  status?: JobStatus
  /** Optional override label (e.g. "Archived Vacancy"). */
  label?: string
  size?: "sm" | "md"
  /**
   * When true, the row is generated demo content: never render a "Live"/"Verified"
   * trust label. Shows a neutral gray "Sample" chip for any open status; archived
   * synthetic rows keep their "Position Filled" label.
   */
  synthetic?: boolean
}

export function JobStatusBadge({ status, label, size = "sm", synthetic = false }: JobStatusBadgeProps) {
  if (!status) return null
  const meta = JOB_STATUS_META[status]
  // Demo content must never claim live/verified trust. Downgrade any open
  // synthetic status to a neutral gray "Sample" chip.
  const isSyntheticOpen = synthetic && status !== "ARCHIVED_JOB"
  const badgeColor = isSyntheticOpen ? "gray" : meta.badgeColor
  const s = STYLES[badgeColor]
  const pad = size === "md" ? "4px 11px" : "3px 9px"
  const fs = size === "md" ? 12 : 10.5
  const dot = badgeColor === "green"
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        padding: pad,
        borderRadius: 100,
        fontSize: fs,
        fontWeight: 800,
        letterSpacing: ".02em",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
      )}
      {isSyntheticOpen ? "Sample" : label || meta.label}
    </span>
  )
}
