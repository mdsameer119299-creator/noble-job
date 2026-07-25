import Link from 'next/link'
import { getBlueCollarJobs } from '@/lib/services/blueCollarJobs'
import { JobLinkPendingDot } from '@/components/jobs/JobLinkPendingDot'

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
    <section style={{ padding: '44px 0', background: 'linear-gradient(180deg,#fef9f0,#fffdf9)' }}>
      <div className="wrap">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: '"Playfair Display",serif', fontSize: 'clamp(20px,2.4vw,26px)', fontWeight: 900, color: '#0d1f4e', margin: 0 }}>
                👷 Blue Collar &amp; Frontline Jobs
              </h2>
              <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, border: '1px solid #fcd34d' }}>
                No Degree Required
              </span>
            </div>
            <p style={{ color: '#6b7280', fontSize: 13.5 }}>Driver, Delivery, Security, Housekeeping, Electrician, Warehouse &amp; 20+ more categories — hiring across India</p>
          </div>
          <Link href="/jobs/private?category=blue-collar" style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', background: '#b45309', padding: '9px 18px', borderRadius: 9, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            View All Blue Collar Jobs →
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
          {jobs.map(job => (
            <Link
              key={job.id}
              href={`/jobs/private/${job.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1.5px solid #f3e2c4',
                borderRadius: 14, padding: '14px 16px', textDecoration: 'none', boxShadow: '0 2px 10px rgba(180,83,9,.06)',
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 11, background: '#fef3e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {CATEGORY_ICON[job.cat] || '💼'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0d1f4e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company} · {job.location}</div>
                <div style={{ fontSize: 11.5, color: '#15803d', fontWeight: 700, marginTop: 2 }}>{job.salary}</div>
              </div>
              <JobLinkPendingDot />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
