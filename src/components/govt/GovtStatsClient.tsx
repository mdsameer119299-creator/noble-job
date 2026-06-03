'use client'

import { AnimatedCounter } from '@/components/heroes/AnimatedCounter'

interface StatItem {
  key: string
  icon: string
  num: number
  label: string
}

export function GovtStatsClient({ items }: { items: StatItem[] }) {
  return (
    <div style={{ display: 'flex', gap: 0, background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', marginBottom: 24, overflow: 'hidden', flexWrap: 'wrap' }}>
      {items.map((s, i) => (
        <div
          key={s.key}
          style={{
            flex: '1 1 140px',
            textAlign: 'center',
            padding: '16px 8px',
            borderRight: i < items.length - 1 ? '1px solid #f0f4ff' : 'none',
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
          <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 22, fontWeight: 900, color: '#1847d4' }}>
            <AnimatedCounter value={s.num} />
            <span style={{ fontSize: 14 }}>+</span>
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}
