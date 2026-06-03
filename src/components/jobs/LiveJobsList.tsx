'use client'
import { useEffect, useState } from 'react'
import { JobCard } from './JobCard'
import { JobsLoadingSkeleton } from './JobsLoadingSkeleton'
import { SourceDisclaimer } from './SourceDisclaimer'
import { useJobFilters } from '@/hooks/useJobFilters'
import type { Job, JobStatus } from '@/types/job'

type Counts = { all: number; live: number; verified: number; archived: number }

function mapLiveJob(raw: Record<string, unknown>, fallbackStatus: JobStatus = 'LIVE_JOB'): Job {
  return {
    id: String(raw.id),
    title: String(raw.title),
    company: String(raw.company || ''),
    logo: String(raw.logo || (raw.company as string)?.slice(0, 2) || 'NJ'),
    logoUrl: (raw.logoUrl as string) ?? null,
    color: String(raw.color || '#1847d4'),
    location: String(raw.location || 'Remote'),
    type: String(raw.type || raw.job_type || 'Full Time'),
    exp: String(raw.exp || raw.experience_required || 'Any Experience'),
    salary: String(raw.salary || 'Competitive'),
    cat: String(raw.cat || raw.category || ''),
    skills: (raw.skills as string[]) || [],
    badge: raw.badge as string | undefined,
    jobStatus: (raw.jobStatus as JobStatus) || fallbackStatus,
    applyUrl: String(raw.applyUrl || raw.apply_url || '#'),
    desc: String(raw.desc || raw.description || ''),
    posted: String(raw.posted || raw.posted_at || 'Recent'),
    verified: Boolean(raw.verified ?? raw.is_verified ?? true),
    source: String(raw.source || 'Noble Job'),
    board: 'private',
  }
}

const STATUS_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'All Jobs' },
  { id: 'LIVE_JOB', label: 'Live Jobs' },
  { id: 'VERIFIED_JOB', label: 'Verified Jobs' },
  { id: 'ARCHIVED_JOB', label: 'Archived Jobs' },
]

export function LiveJobsList() {
  const { q, category, type, location, exp, status, page, setFilter, setPage } = useJobFilters()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState<Counts>({ all: 0, live: 0, verified: 0, archived: 0 })

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (category && category !== 'all') params.set('category', category)
    if (type && type !== 'all') params.set('type', type)
    if (location) params.set('location', location)
    if (exp) params.set('exp', exp)
    if (status && status !== 'all') params.set('status', status)
    params.set('page', String(page))

    // External live jobs only matter when viewing all/live and on the first page.
    const includeLive = (status === 'all' || status === 'LIVE_JOB') && page === 1

    Promise.all([
      fetch(`/api/jobs?${params}`).then(r => (r.ok ? r.json() : null)).catch(() => null),
      includeLive
        ? fetch(`/api/jobs/live`).then(r => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
    ]).then(([dbData, liveData]) => {
      const dbJobs = (dbData?.jobs || []).map((j: Record<string, unknown>) => mapLiveJob(j, 'VERIFIED_JOB'))
      const liveJobs = (liveData?.data || []).map((j: Record<string, unknown>) => mapLiveJob(j, 'LIVE_JOB'))
      const seen = new Set<string>()
      const combined = [...liveJobs, ...dbJobs].filter(j => {
        if (seen.has(j.id)) return false
        seen.add(j.id)
        return true
      })
      const c: Counts = dbData?.counts || { all: 0, live: 0, verified: 0, archived: 0 }
      const liveExtra = liveJobs.length
      setJobs(combined)
      setTotal((dbData?.total || dbJobs.length) + liveExtra)
      setTotalPages(dbData?.totalPages || 1)
      setCounts({ all: c.all + liveExtra, live: c.live + liveExtra, verified: c.verified, archived: c.archived })
    }).finally(() => setLoading(false))
  }, [q, category, type, location, exp, status, page])

  const countFor = (id: string) =>
    id === 'all' ? counts.all : id === 'LIVE_JOB' ? counts.live : id === 'VERIFIED_JOB' ? counts.verified : counts.archived

  return (
    <div>
      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {STATUS_TABS.map(t => {
          const activeTab = (status || 'all') === t.id
          return (
            <button key={t.id} onClick={() => { setFilter('status', t.id === 'all' ? '' : t.id) }}
              style={{
                padding: '7px 14px', borderRadius: 22, border: '1.5px solid',
                fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                borderColor: activeTab ? '#1847d4' : '#e2e8f0',
                background: activeTab ? '#1847d4' : '#fff',
                color: activeTab ? '#fff' : '#374151',
              }}>
              {t.label}
              <span style={{ fontSize: 11, fontWeight: 800, background: activeTab ? 'rgba(255,255,255,.2)' : '#f0f4ff', color: activeTab ? '#fff' : '#1847d4', padding: '1px 7px', borderRadius: 10 }}>
                {countFor(t.id).toLocaleString('en-IN')}
              </span>
            </button>
          )
        })}
      </div>

      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
        Showing <strong style={{ color: '#0d1f4e' }}>{total}</strong> jobs
      </p>

      {loading ? (
        <JobsLoadingSkeleton />
      ) : jobs.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No jobs match your filters.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {jobs.map(job => <JobCard key={job.id} job={job} />)}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 24 }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', color: page <= 1 ? '#cbd5e1' : '#1847d4', fontWeight: 700, fontSize: 13, cursor: page <= 1 ? 'default' : 'pointer' }}>
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', color: page >= totalPages ? '#cbd5e1' : '#1847d4', fontWeight: 700, fontSize: 13, cursor: page >= totalPages ? 'default' : 'pointer' }}>
            Next →
          </button>
        </div>
      )}

      <SourceDisclaimer />
    </div>
  )
}
