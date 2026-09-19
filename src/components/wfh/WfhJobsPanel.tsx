'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { WfhJob } from '@/types/wfhJob'
import { toRenderableWfhJobs } from '@/lib/jobs/clientRecords'
import { WfhJobCard } from './WfhJobCard'
import { WfhDetailModal } from './WfhDetailModal'
import { WfhCategoryChips } from './WfhCategoryChips'
import { WfhFilterSidebar } from './WfhFilterSidebar'
import { TopHiringRemotely } from './TopHiringRemotely'
import { WfhTipsSidebar } from './WfhTipsSidebar'
import { UploadCvCta } from './UploadCvCta'
import { WfhAlertForm } from './WfhAlertForm'

type Counts = { all: number; live: number; verified: number; archived: number }

const STATUS_TABS = [
  { id: 'all', label: 'All Jobs' },
  { id: 'LIVE_JOB', label: 'Live Jobs' },
  { id: 'VERIFIED_JOB', label: 'Verified' },
  { id: 'ARCHIVED_JOB', label: 'Archived' },
]

export function WfhJobsPanel() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [jobs, setJobs] = useState<WfhJob[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState<Counts>({ all: 0, live: 0, verified: 0, archived: 0 })
  const [selected, setSelected] = useState<WfhJob | null>(null)

  const q = params.get('q') || ''
  const cat = params.get('cat') || 'all'
  const exp = params.get('exp') || 'all'
  const sort = params.get('sort') || 'latest'
  const status = params.get('status') || 'all'
  const page = Number(params.get('page') || 1)

  const setParam = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(params.toString())
      if (value) p.set(key, value)
      else p.delete(key)
      if (key !== 'page') p.delete('page')
      router.push(`${pathname}?${p}`, { scroll: false })
    },
    [router, pathname, params],
  )

  const [localQ, setLocalQ] = useState(q)
  useEffect(() => {
    setLocalQ(q)
  }, [q])

  useEffect(() => {
    setLoading(true)
    const sp = new URLSearchParams({ cat, exp, sort, page: String(page) })
    if (q) sp.set('q', q)
    if (status && status !== 'all') sp.set('status', status)
    fetch(`/api/wfh-jobs?${sp}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        // A failed request is an ERROR state — never an empty list that reads as "no jobs".
        if (!d) { setFailed(true); setJobs([]); setTotal(0); setTotalPages(1); return }
        setFailed(false)
        // Re-check every record on the client: anything incomplete is dropped and the
        // total is reduced by exactly what was dropped, so count === displayed jobs.
        const raw: unknown[] = Array.isArray(d.data) ? d.data : Array.isArray(d.jobs) ? d.jobs : []
        const ok = toRenderableWfhJobs(raw)
        const dropped = raw.length - ok.length
        setJobs(ok)
        setTotal(Math.max(0, (Number(d.total) || ok.length) - dropped))
        setTotalPages(Number(d.totalPages) || 1)
        if (d.counts) setCounts({ ...d.counts, all: Math.max(0, (d.counts.all ?? 0) - dropped) })
      })
      .catch(() => { setFailed(true); setJobs([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [q, cat, exp, sort, status, page])

  const countFor = (id: string) =>
    id === 'all'
      ? counts.all
      : id === 'LIVE_JOB'
        ? counts.live
        : id === 'VERIFIED_JOB'
          ? counts.verified
          : counts.archived

  return (
    <div className="wfh-panel">
      <div className="wfh-panel__search">
        <svg fill="currentColor" viewBox="0 0 24 24" width={20} height={20} style={{ color: '#94a3b8', flexShrink: 0 }} aria-hidden>
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
        <input
          value={localQ}
          onChange={e => setLocalQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') setParam('q', localQ)
          }}
          placeholder="Search WFH jobs, skills, companies…"
          aria-label="Search work from home jobs"
        />
      </div>

      <WfhCategoryChips active={cat} onChange={c => setParam('cat', c === 'all' ? '' : c)} />

      <div className="wfh-panel__status-tabs">
        {STATUS_TABS.map(t => {
          const activeTab = status === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setParam('status', t.id === 'all' ? '' : t.id)}
              className={`wfh-panel__status-tab${activeTab ? ' wfh-panel__status-tab--active' : ''}`}
            >
              {t.label}
              <span className="wfh-panel__status-tab-count">{countFor(t.id).toLocaleString('en-IN')}</span>
            </button>
          )
        })}
      </div>

      <div className="wfh-panel__layout" id="wfh-jobs">
        <WfhFilterSidebar
          exp={exp}
          sort={sort}
          onExp={v => setParam('exp', v === 'all' ? '' : v)}
          onSort={v => setParam('sort', v)}
        />

        <div>
          {!failed && (
            <p className="wfh-panel__results-meta">
              Showing <strong>{total.toLocaleString('en-IN')}</strong> work from home jobs
            </p>
          )}
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b', fontSize: 15 }}>Loading WFH jobs…</div>
          ) : failed ? (
            <div role="alert" style={{ padding: 48, textAlign: 'center', color: '#b45309', fontSize: 15 }}>We couldn&apos;t load jobs right now. Please refresh and try again.</div>
          ) : jobs.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b', fontSize: 15 }}>No WFH jobs match your filters.</div>
          ) : (
            <div className="wfh-panel__job-list">
              {jobs.map(j => (
                <WfhJobCard key={j.id} job={j} onClick={setSelected} />
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 28 }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setParam('page', String(page - 1))}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: '1.5px solid #e2e8f0',
                  background: '#fff',
                  color: page <= 1 ? '#cbd5e1' : '#7c3aed',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: page <= 1 ? 'default' : 'pointer',
                }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600, alignSelf: 'center' }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setParam('page', String(page + 1))}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: '1.5px solid #e2e8f0',
                  background: '#fff',
                  color: page >= totalPages ? '#cbd5e1' : '#7c3aed',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: page >= totalPages ? 'default' : 'pointer',
                }}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        <div className="wfh-panel__sidebar">
          <TopHiringRemotely />
          <WfhTipsSidebar />
          <UploadCvCta />
          <WfhAlertForm />
        </div>
      </div>

      <WfhDetailModal job={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}
