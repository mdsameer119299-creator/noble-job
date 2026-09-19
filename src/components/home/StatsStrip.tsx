// StatsStrip — exact replica of original <div class="stats"> section
// background:#0a1635 (navy2), 5 stat items with dividers
// Stats: 10,000+ Active Jobs | 2,500+ Companies | 50,000+ Happy Candidates | 1,200+ Govt Jobs | 1,500+ Abroad Jobs
import { Fragment } from 'react'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { formatCounter } from '@/lib/config/jobStrategy'
import { getVisibleBoardCounts } from '@/lib/services/visibleCounts'

const STAT_ICONS = {
  jobs: (
    <svg fill="currentColor" viewBox="0 0 24 24" width={24} height={24}><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM9 4h6v2H9V4z"/></svg>
  ),
  companies: (
    <svg fill="currentColor" viewBox="0 0 24 24" width={24} height={24}><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>
  ),
  candidates: (
    <svg fill="currentColor" viewBox="0 0 24 24" width={24} height={24}><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
  ),
  govt: (
    <svg fill="currentColor" viewBox="0 0 24 24" width={24} height={24}><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
  ),
  abroad: (
    <svg fill="currentColor" viewBox="0 0 24 24" width={24} height={24}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
  ),
}

export async function StatsStrip() {
  // TWO HONEST BUCKETS (see src/lib/jobs/provenance.ts):
  //  • "Roles to Explore" = the full browsable catalog (includes demo showcase
  //    inventory). It is a browse figure, NOT a claim of genuine live openings.
  //  • "Live Jobs" / "Verified Employers" = GENUINE only, counted from the DB
  //    (real employer + govt rows). Never padded with synthetic targets.
  // Counted by the same pipeline as the lists it summarises (renderable only, synthetic
  // switch honoured) — never more roles than a candidate can open.
  const catalogRoles = (await getVisibleBoardCounts()).total.all
  let liveJobs = 0
  let employers = 0
  if (isSupabaseConfigured()) {
    try {
      const sb = await createClient()
      if (!sb) throw new Error('skip')
      const { getGenuineJobCounts } = await import('@/lib/services/genuineCounts')
      const [genuine, verified] = await Promise.all([
        // Genuine + open + renderable — the same predicate the sitemap uses, never a
        // raw `status = active` row count (which includes samples / incomplete rows).
        getGenuineJobCounts(),
        sb.from('employers').select('id', { count: 'exact', head: true }).eq('verified', true),
      ])
      liveJobs = genuine.total
      employers = verified.count || 0
    } catch {}
  }

  const items = [
    ...(catalogRoles > 0 ? [{ key: 'catalog', num: formatCounter(catalogRoles), label: 'Roles to Explore', icon: STAT_ICONS.jobs }] : []),
    { key: 'live',      num: liveJobs > 0 ? formatCounter(liveJobs) : 'Daily',   label: 'Live Jobs',          icon: STAT_ICONS.companies  },
    { key: 'govt',      num: 'Daily',                                            label: 'Govt Updates',       icon: STAT_ICONS.govt       },
    { key: 'employers', num: employers > 0 ? formatCounter(employers) : 'Growing', label: 'Verified Employers', icon: STAT_ICONS.candidates },
  ]

  return (
    <div style={{ background: '#0a1635', padding: '30px 0' }}>
      <div className="section-inner-pad" style={{ maxWidth: 1360, margin: '0 auto', padding: '0 clamp(16px, 4vw, 48px)' }}>
        <div className="stats-strip" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '18px 24px' }}>
          {items.map((item, i) => (
            <Fragment key={item.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Icon box */}
                <div style={{
                  width: 52, height: 52,
                  border: '1.5px solid rgba(255,255,255,.12)',
                  borderRadius: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,.05)',
                  color: 'rgba(255,255,255,.8)',
                  flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                {/* Data */}
                <div>
                  <h3 style={{
                    fontFamily: '"Playfair Display", serif',
                    fontSize: 'clamp(22px, 5vw, 34px)', fontWeight: 900,
                    color: '#fff', lineHeight: 1,
                    letterSpacing: '-.03em',
                  }}>{item.num}</h3>
                  <p style={{ fontSize: 14, color: '#6a8ab0', marginTop: 5, fontWeight: 500, letterSpacing: '.01em' }}>{item.label}</p>
                </div>
              </div>
              {/* Divider between items */}
              {i < items.length - 1 && (
                <div className="stats-divider" style={{ width: 1, height: 46, background: 'rgba(255,255,255,.07)' }} />
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
