interface StepIndicatorProps { total: number; current: number }
export function StepIndicator({ total, current }: StepIndicatorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, justifyContent: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, transition: 'all .2s', background: i < current ? '#15803d' : i === current ? '#1847d4' : '#e2e8f0', color: i <= current ? '#fff' : '#9ca3af' }}>
            {i < current ? '✓' : i + 1}
          </div>
          {i < total - 1 && <div style={{ width: 40, height: 2, background: i < current ? '#15803d' : '#e2e8f0', transition: 'all .2s' }} />}
        </div>
      ))}
    </div>
  )
}
