import Link from 'next/link'
import { getBlueCollarJobs } from '@/lib/services/blueCollarJobs'

const CATEGORY_ICON: Record<string, string> = {
  Driver: '🚗',
  'Delivery Boy': '🛵',
  'Security Guard': '🛡️',
  Housekeeping: '🧹',
  Helper: '🤝',
  Electrician: '🔌',
  Plumber: '🔧',
  'Shop Assistant': '🛒',
  'Office Boy': '📋',
  Receptionist: '📞',
  Cook: '👨‍🍳',
  Maid: '🏠',
  'Warehouse Staff': '📦',
  Carpenter: '🪚',
  Welder: '🔩',
  Mechanic: '🔧',
  'Factory Worker': '🏭',
  'Packing Staff': '📦',
  Loader: '🚚',
  Telecaller: '☎️',
  'Retail Sales': '🛍️',
  'Field Sales': '📈',
  Cashier: '💵',
  Beautician: '💇',
  'Nursing Assistant': '🩺',
  'Lab Technician': '🧪',
}

/** Renders nothing when there's no blue-collar inventory to show yet. */
export async function BlueCollarJobsSection() {
  const jobs = await getBlueCollarJobs(8)
  if (jobs.length === 0) return null

  return (
    <section style={{ padding: '40px 0 8px' }} className="wrap">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: '"Playfair Display",serif', fontSize: 'clamp(20px,2.4vw,26px)', fontWeight: 900, color: '#0d1f4e', marginBottom: 4 }}>
            🔧 Blue Collar &amp; Frontline Jobs
          </h2>
          <p style={{ color: '#6b7280', fontSize: 13.5 }}>Driver, Delivery, Security, Housekeeping, Electrician &amp; more — no degree required</p>
        </div>
        <Link href="/jobs/private" style={{ fontSize: 13.5, fontWeight: 700, color: '#1847d4', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          View All →
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        {jobs.map(job => (
          <Link
            key={job.id}
            href={`/jobs/private/${job.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1.5px solid #e2e8f0',
              borderRadius: 14, padding: '14px 16px', textDecoration: 'none', boxShadow: '0 2px 10px rgba(24,71,212,.05)',
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 11, background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {CATEGORY_ICON[job.cat] || '💼'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0d1f4e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
              <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company} · {job.location}</div>
              <div style={{ fontSize: 11.5, color: '#15803d', fontWeight: 700, marginTop: 2 }}>{job.salary}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
