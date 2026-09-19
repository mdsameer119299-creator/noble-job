// LatestJobsGrid — exact replica of original <section class="lj-section">
// 4-column grid: Private Jobs, Govt Jobs, WFH Jobs, Abroad Jobs
// Each col has: icon header, 4 job items, "View More" link
import Link from 'next/link'
import { getLatestJobCards, type FeaturedJobCard } from '@/lib/services/featuredJobs'
import { getGovtJobs } from '@/lib/services/govtJobService'
import { filterActionable, isRealDisplayValue } from '@/lib/jobs/renderable'

const CheckIcon = () => (
  <svg fill="currentColor" viewBox="0 0 24 24" width={16} height={16} style={{ color: '#15803d' }}>
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
  </svg>
)

interface LjItem {
  logo: string
  logoColor: string
  title: string
  company: string
  meta: string | React.ReactNode
  isGovt?: boolean
  flag?: string
}

function LjCol({ icon, iconBg, iconColor, title, count, viewHref, items }: {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  title: string
  count?: string
  viewHref: string
  items: LjItem[]
}) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 20,
      padding: 22,
      boxShadow: '0 4px 20px rgba(13,31,78,.07)',
    }}>
      {/* Column header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 11,
        marginBottom: 18, paddingBottom: 16,
        borderBottom: '1.5px solid #f0f4ff',
        flexWrap: 'wrap', position: 'relative',
      }}>
        <div style={{ width: 40, height: 40, background: iconBg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: 15.5, fontWeight: 800, color: '#0d1f4e', letterSpacing: '-.01em', marginBottom: 2 }}>{title}</h3>
          {count && <span style={{ fontSize: 12.5, color: '#6b7280', fontWeight: 500 }}>{count}</span>}
        </div>
        <Link href={viewHref} style={{ fontSize: 12.5, fontWeight: 700, color: '#1847d4', whiteSpace: 'nowrap', textDecoration: 'none' }}>
          View All →
        </Link>
      </div>

      {/* Job items — an empty column is an intentional empty state, never made-up jobs. */}
      {items.length === 0 && (
        <p style={{ fontSize: 13.5, color: '#6b7280', margin: 0, padding: '10px 6px', lineHeight: 1.6 }}>
          New openings are being added. Browse the full listing to see everything currently available.
        </p>
      )}
      <div>
        {items.map((item, i) => (
          <Link key={i} href={viewHref}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 6px', borderBottom: i < items.length - 1 ? '1px solid #f5f7ff' : 'none',
              cursor: 'pointer', borderRadius: 10, textDecoration: 'none',
            }}>
            {/* Logo */}
            {item.flag ? (
              <div style={{ width: 44, height: 44, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, background: '#f8faff' }}>
                {item.flag}
              </div>
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: 11, background: item.logoColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0, letterSpacing: '.02em' }}>
                {item.logo}
              </div>
            )}

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0d1f4e', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
              <div style={{ fontSize: 12.5, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.company}</div>
              <div style={{ marginTop: 3 }}>{item.meta}</div>
            </div>

            {/* Govt badge */}
            {item.isGovt && (
              <span style={{ background: '#eff6ff', color: '#1847d4', fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 8, flexShrink: 0 }}>New</span>
            )}
          </Link>
        ))}
      </div>

      {/* View More link */}
      <Link href={viewHref}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 16, fontSize: 14, fontWeight: 700, color: '#1847d4', textDecoration: 'none' }}>
        View All {title}
        <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16}><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
      </Link>
    </div>
  )
}

const initials = (v: string, n: number) => v.replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, n).toUpperCase()

/** A real, actionable job → a grid item. Only real values are rendered (no "Competitive"/"India" filler). */
function toItem(j: FeaturedJobCard, badge?: string): LjItem {
  return {
    logo: initials(j.company, 3),
    logoColor: j.color || '#1847d4',
    title: j.title,
    company: [j.company, j.location].filter(isRealDisplayValue).join(' · '),
    meta: (j.salary || badge) ? (
      <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>
        {j.salary}
        {badge ? <span style={{ background: '#15803d', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4, marginLeft: j.salary ? 4 : 0 }}>{badge}</span> : null}
      </div>
    ) : null,
  }
}

export async function LatestJobsGrid() {
  // NO EMPTY / FAKE JOBS: every item is a real, actionable record from the gated
  // services. Nothing is hand-written, and no headline counters are invented.
  const [privateCards, wfhCards, abroadCards, govtPool] = await Promise.all([
    getLatestJobCards('private', 4),
    getLatestJobCards('wfh', 4),
    getLatestJobCards('abroad', 4),
    getGovtJobs('latest').catch(() => []),
  ])
  const privateJobs: LjItem[] = privateCards.map(j => toItem(j))
  const wfhJobs: LjItem[] = wfhCards.map(j => toItem(j, 'WFH'))
  const abroadJobs: LjItem[] = abroadCards.map(j => toItem(j))
  const govtJobs: LjItem[] = filterActionable(govtPool, 'govt').slice(0, 4).map(j => ({
    logo: initials(String(j.short || j.org || ''), 4),
    logoColor: j.color || '#1e3a8a',
    title: j.title,
    company: j.org,
    meta: isRealDisplayValue(j.lastDate)
      ? <div style={{ fontSize: 12, color: '#6b7280' }}>Apply by <strong style={{ color: '#0d1f4e' }}>{j.lastDate}</strong></div>
      : null,
    isGovt: true,
  }))

  return (
    <section style={{
      padding: '38px 0 80px',
      background: 'linear-gradient(180deg, #f0f4ff 0%, #e8effe 60%, #f7f9ff 100%)',
    }}>
      <div className="section-inner-pad" style={{ maxWidth: 1360, margin: '0 auto', padding: '0 clamp(16px, 4vw, 48px)' }}>
        {/* Section header */}
        <div style={{ marginBottom: 'clamp(28px, 5vw, 52px)' }}>
          <h2 style={{
            fontFamily: '"Playfair Display", serif',
            fontSize: 'clamp(24px, 5.5vw, 38px)', fontWeight: 900,
            color: '#0d1f4e',
            letterSpacing: '-.025em', marginBottom: 8,
          }}>Latest Job Openings</h2>
          <p style={{ fontSize: 'clamp(14px, 3.5vw, 16px)', color: '#6b7280' }}>
            Freshly posted vacancies across Private, Government, Remote &amp; International sectors
          </p>
        </div>

        {/* Responsive jobs grid: 4 → 2 → 1 columns (see .lj-grid in mobile-responsive.css) */}
        <div className="lj-grid" style={{
          display: 'grid',
          gap: 22,
          alignItems: 'start',
        }}>
          <LjCol
            icon={<svg viewBox="0 0 24 24" fill="#1847d4" width={20} height={20}><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM9 4h6v2H9V4z"/></svg>}
            iconBg="#eff6ff" iconColor="#1847d4"
            title="Latest Private Jobs"
            viewHref="/jobs/private" items={privateJobs}
          />
          <LjCol
            icon={<svg viewBox="0 0 24 24" fill="#f07020" width={20} height={20}><path d="M12 2L2 7v2h20V7L12 2zM4 11v6H2v2h20v-2h-2v-6h-2v6h-3v-6h-2v6h-2v-6H9v6H6v-6H4z"/></svg>}
            iconBg="#fff7ed" iconColor="#f07020"
            title="Latest Government Jobs"
            viewHref="/jobs/govt" items={govtJobs}
          />
          <LjCol
            icon={<svg viewBox="0 0 24 24" fill="#15803d" width={20} height={20}><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>}
            iconBg="#f0fdf4" iconColor="#15803d"
            title="Work From Home Jobs"
            viewHref="/jobs/wfh" items={wfhJobs}
          />
          <LjCol
            icon={<svg viewBox="0 0 24 24" fill="#7c3aed" width={20} height={20}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>}
            iconBg="#faf5ff" iconColor="#7c3aed"
            title="Latest Abroad Jobs"
            viewHref="/jobs/abroad" items={abroadJobs}
          />
        </div>
      </div>
    </section>
  )
}
