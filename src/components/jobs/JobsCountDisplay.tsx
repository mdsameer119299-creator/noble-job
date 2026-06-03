interface JobsCountDisplayProps { count: number; total: number }

export function JobsCountDisplay({ count, total }: JobsCountDisplayProps) {
  return (
    <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
      Showing <strong style={{ color: '#0d1f4e' }}>{count}</strong> of <strong style={{ color: '#0d1f4e' }}>{total}</strong> jobs
    </p>
  )
}
