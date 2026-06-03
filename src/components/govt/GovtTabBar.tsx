'use client'
import { GOVT_CATEGORIES, type GovtJobTab } from '@/types/govtJob'

interface GovtTabBarProps { active: GovtJobTab; onChange: (t: GovtJobTab) => void }

export function GovtTabBar({ active, onChange }: GovtTabBarProps) {
  const stages = GOVT_CATEGORIES.filter(c => c.kind === 'stage')
  const sectors = GOVT_CATEGORIES.filter(c => c.kind === 'sector')
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {stages.map(t => (
          <button key={t.id} onClick={() => onChange(t.id)}
            style={{ padding: '9px 16px', borderRadius: 22, border: '1.5px solid', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all .2s', borderColor: active === t.id ? '#1847d4' : '#e2e8f0', background: active === t.id ? '#1847d4' : '#fff', color: active === t.id ? '#fff' : '#374151' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', alignSelf: 'center', marginRight: 4 }}>By Sector:</span>
        {sectors.map(t => (
          <button key={t.id} onClick={() => onChange(t.id)}
            style={{ padding: '7px 13px', borderRadius: 18, border: '1.5px solid', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all .2s', borderColor: active === t.id ? '#1e3a8a' : '#e2e8f0', background: active === t.id ? '#1e3a8a' : '#fff', color: active === t.id ? '#fff' : '#475569' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
