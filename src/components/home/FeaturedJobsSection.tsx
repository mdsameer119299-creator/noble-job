import Link from 'next/link'
import { getFeaturedJobsMix, type FeaturedJobCard } from '@/lib/services/featuredJobs'

const BOARD_LABEL: Record<FeaturedJobCard['board'], string> = { private: 'Private', wfh: 'Work From Home', abroad: 'Abroad' }
const BOARD_HREF = (card: FeaturedJobCard) => `/jobs/${card.board}/${card.id}`

/**
 * Genuine-employer jobs only (see featuredJobs.ts), balanced across all three
 * employer-postable boards — renders nothing when there aren't any yet,
 * rather than padding the section with synthetic content just to avoid an
 * empty state.
 */
export async function FeaturedJobsSection() {
  const jobs = await getFeaturedJobsMix(6)
  if (jobs.length === 0) return null

  return (
    <section style={{ padding: '48px 0 8px' }} className="wrap">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: '"Playfair Display",serif', fontSize: 'clamp(20px,2.4vw,26px)', fontWeight: 900, color: '#0d1f4e', marginBottom: 4 }}>
            ⭐ Featured Jobs
          </h2>
          <p style={{ color: '#6b7280', fontSize: 13.5 }}>Verified openings from real employers — Private, Work From Home &amp; Abroad</p>
        </div>
        <Link href="/jobs/private" style={{ fontSize: 13.5, fontWeight: 700, color: '#1847d4', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          View All Jobs →
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
        {jobs.map(job => (
          <Link
            key={`${job.board}-${job.id}`}
            href={BOARD_HREF(job)}
            style={{
              display: 'block', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16,
              padding: '18px 20px', textDecoration: 'none', boxShadow: '0 2px 12px rgba(24,71,212,.06)',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: job.color || '#1847d4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                {job.company?.slice(0, 2).toUpperCase() || 'NJ'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: '"Playfair Display",serif', fontWeight: 800, fontSize: 14.5, color: '#0d1f4e', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.title}
                </div>
                <div style={{ fontSize: 12.5, color: '#6b7280' }}>{job.company}</div>
              </div>
              <span style={{ background: '#eff6ff', color: '#1847d4', fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 8, flexShrink: 0 }}>Verified</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ background: '#f0f4ff', color: '#374151', padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>📍 {job.location}</span>
              {job.salary && <span style={{ background: '#f0f4ff', color: '#374151', padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>💰 {job.salary}</span>}
              <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>{BOARD_LABEL[job.board]}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
