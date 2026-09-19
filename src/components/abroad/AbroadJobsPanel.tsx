'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { AbroadJob } from '@/types/abroadJob'
import { toRenderableAbroadJobs } from '@/lib/jobs/clientRecords'
import { AbroadJobCard } from './AbroadJobCard'
import { AbroadDetailModal } from './AbroadDetailModal'
import { AbroadSearchBar } from './AbroadSearchBar'
import { AbroadFilterSidebar } from './AbroadFilterSidebar'
import { AbroadCountriesClient, type CountryCount } from './AbroadCountriesClient'
import { DreamJobCta } from './DreamJobCta'
import { AiRecommendations } from './AiRecommendations'
import { AbroadAlertForm } from './AbroadAlertForm'

type Counts = { all: number; live: number; verified: number; archived: number }

const STATUS_TABS = [
  { id: 'all', label: 'All Jobs' },
  { id: 'LIVE_JOB', label: 'Live Jobs' },
  { id: 'VERIFIED_JOB', label: 'Verified' },
  { id: 'ARCHIVED_JOB', label: 'Archived' },
]

export function AbroadJobsPanel({ countries }: { countries: CountryCount[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [jobs, setJobs] = useState<AbroadJob[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState<Counts>({ all: 0, live: 0, verified: 0, archived: 0 })
  const [selected, setSelected] = useState<AbroadJob | null>(null)

  const q = params.get('q') || ''
  const country = params.get('country') || ''
  const category = params.get('category') || ''
  const status = params.get('status') || 'all'
  const page = Number(params.get('page') || 1)

  const setParam = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(params.toString())
    if (value) p.set(key, value); else p.delete(key)
    if (key !== 'page') p.delete('page')
    router.push(`${pathname}?${p}`, { scroll: false })
  }, [router, pathname, params])

  useEffect(() => {
    setLoading(true)
    const sp = new URLSearchParams({ page: String(page) })
    if (q) sp.set('q', q)
    if (country) sp.set('country', country)
    if (category) sp.set('category', category)
    if (status && status !== 'all') sp.set('status', status)
    fetch(`/api/abroad-jobs?${sp}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        // A failed request is an ERROR state — never an empty list that reads as "no jobs".
        if (!d) { setFailed(true); setJobs([]); setTotal(0); setTotalPages(1); return }
        setFailed(false)
        // Re-check every record on the client; count === displayed jobs.
        const raw: unknown[] = Array.isArray(d.data) ? d.data : Array.isArray(d.jobs) ? d.jobs : []
        const ok = toRenderableAbroadJobs(raw)
        const dropped = raw.length - ok.length
        setJobs(ok)
        setTotal(Math.max(0, (Number(d.total) || ok.length) - dropped))
        setTotalPages(Number(d.totalPages) || 1)
        if (d.counts) setCounts({ ...d.counts, all: Math.max(0, (d.counts.all ?? 0) - dropped) })
      })
      .catch(() => { setFailed(true); setJobs([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [q, country, category, status, page])

  const countFor = (id: string) =>
    id === 'all' ? counts.all : id === 'LIVE_JOB' ? counts.live : id === 'VERIFIED_JOB' ? counts.verified : counts.archived

  return (
    <div className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
      <AbroadCountriesClient countries={countries} onCountry={c => setParam('country', country === c ? '' : c)} />
      <AbroadSearchBar q={q} country={country} onQ={v => setParam('q', v)} onCountry={c => setParam('country', c)} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {STATUS_TABS.map(t => {
          const activeTab = status === t.id
          return (
            <button key={t.id} onClick={() => setParam('status', t.id === 'all' ? '' : t.id)}
              style={{
                padding: '7px 14px', borderRadius: 22, border: '1.5px solid', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                borderColor: activeTab ? '#0369a1' : '#e2e8f0',
                background: activeTab ? '#0369a1' : '#fff',
                color: activeTab ? '#fff' : '#374151',
              }}>
              {t.label}
              <span style={{ fontSize: 11, fontWeight: 800, background: activeTab ? 'rgba(255,255,255,.2)' : '#e0f2fe', color: activeTab ? '#fff' : '#0369a1', padding: '1px 7px', borderRadius: 10 }}>
                {countFor(t.id).toLocaleString('en-IN')}
              </span>
            </button>
          )
        })}
      </div>

      <div className="jobs-layout-3col" id="abroad-jobs">
        <AbroadFilterSidebar country={country} onCountry={c => setParam('country', c)} />
        <div>
          {!failed && (
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
              Showing <strong style={{ color: '#0d1f4e' }}>{total.toLocaleString('en-IN')}</strong> international jobs
            </p>
          )}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading abroad jobs…</div>
          ) : failed ? (
            <div role="alert" style={{ padding: 40, textAlign: 'center', color: '#b45309' }}>We couldn&apos;t load jobs right now. Please refresh and try again.</div>
          ) : jobs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No abroad jobs match your filters.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {jobs.map(j => <AbroadJobCard key={j.id} job={j} onClick={setSelected} />)}
            </div>
          )}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24 }}>
              <button disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}
                style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', color: page <= 1 ? '#cbd5e1' : '#0369a1', fontWeight: 700, fontSize: 13, cursor: page <= 1 ? 'default' : 'pointer' }}>← Prev</button>
              <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setParam('page', String(page + 1))}
                style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', color: page >= totalPages ? '#cbd5e1' : '#0369a1', fontWeight: 700, fontSize: 13, cursor: page >= totalPages ? 'default' : 'pointer' }}>Next →</button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <DreamJobCta />
          <AiRecommendations />
          <AbroadAlertForm />
        </div>
      </div>
      <AbroadDetailModal job={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}
