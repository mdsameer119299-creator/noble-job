// LatestJobsGrid — exact replica of original <section class="lj-section">
// 4-column grid: Private Jobs, Govt Jobs, WFH Jobs, Abroad Jobs
// Each col has: icon header, 4 job items, "View More" link
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

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
  count: string
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
          <span style={{ fontSize: 12.5, color: '#6b7280', fontWeight: 500 }}>{count}</span>
        </div>
        <Link href={viewHref} style={{ fontSize: 12.5, fontWeight: 700, color: '#1847d4', whiteSpace: 'nowrap', textDecoration: 'none' }}>
          View All →
        </Link>
      </div>

      {/* Job items */}
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

export async function LatestJobsGrid() {
  // Try to pull real data from DB for fresh jobs
  let privateJobs: LjItem[] = []
  let govtJobs: LjItem[] = []
  if (isSupabaseConfigured()) {
  try {
    const sb = await createClient()
    if (!sb) throw new Error('skip')
    const [pj, gj] = await Promise.all([
      sb.from('jobs').select('id,title,company,location,salary_min,salary_max,color,badge').eq('status','active').order('posted_at',{ascending:false}).limit(4),
      sb.from('govt_jobs').select('id,title,org,short,vacancies,last_date,color').eq('status','active').eq('tab','latest').order('sort_order').limit(4),
    ])
    if ((pj.data || []).length >= 4) {
      privateJobs = (pj.data || []).map((j: any) => ({
        logo: (j.company || '').slice(0,3).toUpperCase(),
        logoColor: j.color || '#1847d4',
        title: j.title,
        company: `${j.company || ''} · ${j.location || 'India'}`,
        meta: <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>₹ {j.salary_min ? `${(j.salary_min/100000).toFixed(0)} – ${(j.salary_max/100000).toFixed(0)} LPA` : 'Competitive'} {j.badge === 'Hot' ? <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>Hot</span> : null}</div>,
      }))
    }
    if ((gj.data || []).length >= 4) {
      govtJobs = (gj.data || []).map((j: any) => ({
        logo: (j.short || '').slice(0,4),
        logoColor: j.color || '#1e3a8a',
        title: j.title,
        company: j.org,
        meta: <div style={{ fontSize: 12, color: '#6b7280' }}>Apply by <strong style={{ color: '#0d1f4e' }}>{j.last_date}</strong></div>,
        isGovt: true,
      }))
    }
  } catch {}
  }

  // Fallback to hardcoded original HTML data if DB empty
  if (privateJobs.length < 4) {
    privateJobs = [
      { logo: 'TCS', logoColor: '#1847d4', title: 'Software Engineer', company: 'TCS · Bangalore', meta: <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>₹ 6 – 12 LPA</span> },
      { logo: 'INF', logoColor: '#f59e0b', title: 'Data Analyst', company: 'Infosys · Pune', meta: <><span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>₹ 4 – 8 LPA </span><span style={{ background: '#ef4444', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4 }}>Hot</span></> },
      { logo: 'ZHO', logoColor: '#ef4444', title: 'Product Manager', company: 'Zoho · Chennai', meta: <><span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>₹ 10 – 16 LPA </span><span style={{ background: '#ef4444', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4 }}>Hot</span></> },
      { logo: 'WIP', logoColor: '#8b5cf6', title: 'HR Executive', company: 'Wipro · Hyderabad', meta: <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>₹ 3 – 6 LPA</span> },
    ]
  }
  if (govtJobs.length < 4) {
    govtJobs = [
      { logo: 'SSC', logoColor: '#1a56db', title: 'SSC CGL 2024', company: 'Staff Selection Commission', meta: <div style={{ fontSize: 12, color: '#6b7280' }}>Apply by <strong style={{ color: '#0d1f4e' }}>24 Jun 2024</strong></div>, isGovt: true },
      { logo: 'IAS', logoColor: '#7c2d12', title: 'UPSC Civil Services', company: 'Union Public Service Commission', meta: <div style={{ fontSize: 12, color: '#6b7280' }}>Apply by <strong style={{ color: '#0d1f4e' }}>17 Jun 2024</strong></div>, isGovt: true },
      { logo: 'RRB', logoColor: '#b91c1c', title: 'RRB Technician 2024', company: 'Railway Recruitment Board', meta: <div style={{ fontSize: 12, color: '#6b7280' }}>Apply by <strong style={{ color: '#0d1f4e' }}>30 Jun 2024</strong></div>, isGovt: true },
      { logo: 'SBI', logoColor: '#1e3a8a', title: 'SBI Apprentice 2026', company: 'State Bank of India · 7150 Posts', meta: <div style={{ fontSize: 12, color: '#6b7280' }}>Apply by <strong style={{ color: '#0d1f4e' }}>08 Jun 2026</strong></div>, isGovt: true },
    ]
  }

  const wfhJobs: LjItem[] = [
    { logo: 'NK', logoColor: '#f07020', title: 'Content Writer (SEO)', company: 'Naukri · Remote', meta: <><span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>₹ 2.5 – 4 LPA </span><span style={{ background: '#15803d', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4 }}>WFH</span></> },
    { logo: 'TM', logoColor: '#1847d4', title: 'Customer Support', company: 'Tech Mahindra · Remote', meta: <><span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>₹ 2 – 4 LPA </span><span style={{ background: '#15803d', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4 }}>WFH</span></> },
    { logo: 'WFX', logoColor: '#f59e0b', title: 'Digital Marketing', company: 'WebFX · Remote', meta: <><span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>₹ 4 – 7 LPA </span><span style={{ background: '#15803d', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4 }}>WFH</span></> },
    { logo: 'BLV', logoColor: '#0e7490', title: 'Virtual Assistant', company: 'Believ · Remote', meta: <><span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>₹ 2 – 4 LPA </span><span style={{ background: '#15803d', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4 }}>WFH</span></> },
  ]

  const abroadJobs: LjItem[] = [
    { logo: '', logoColor: '', flag: '🇦🇪', title: 'Nurse', company: 'NMC Healthcare · UAE', meta: <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>₹ 25 – 35 LPA</span> },
    { logo: '', logoColor: '', flag: '🇦🇪', title: 'Civil Engineer', company: 'Al Naboodah · Dubai', meta: <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>₹ 30 – 45 LPA</span> },
    { logo: '', logoColor: '', flag: '🇨🇦', title: 'Hotel Manager', company: 'Marriott International · Canada', meta: <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>₹ 20 – 30 LPA</span> },
    { logo: '', logoColor: '', flag: '🇨🇦', title: 'Accountant', company: 'Canada Offices · Canada', meta: <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>₹ 28 – 40 LPA</span> },
  ]

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
            title="Latest Private Jobs" count="4,800+ openings"
            viewHref="/jobs/private" items={privateJobs}
          />
          <LjCol
            icon={<svg viewBox="0 0 24 24" fill="#f07020" width={20} height={20}><path d="M12 2L2 7v2h20V7L12 2zM4 11v6H2v2h20v-2h-2v-6h-2v6h-3v-6h-2v6h-2v-6H9v6H6v-6H4z"/></svg>}
            iconBg="#fff7ed" iconColor="#f07020"
            title="Latest Government Jobs" count="1,245+ notifications"
            viewHref="/jobs/govt" items={govtJobs}
          />
          <LjCol
            icon={<svg viewBox="0 0 24 24" fill="#15803d" width={20} height={20}><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>}
            iconBg="#f0fdf4" iconColor="#15803d"
            title="Work From Home Jobs" count="8,500+ remote roles"
            viewHref="/jobs/wfh" items={wfhJobs}
          />
          <LjCol
            icon={<svg viewBox="0 0 24 24" fill="#7c3aed" width={20} height={20}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>}
            iconBg="#faf5ff" iconColor="#7c3aed"
            title="Latest Abroad Jobs" count="2,300+ international"
            viewHref="/jobs/abroad" items={abroadJobs}
          />
        </div>
      </div>
    </section>
  )
}
