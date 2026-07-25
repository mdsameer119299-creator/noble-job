'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { Job } from '@/types/job'
import { Badge } from '@/components/ui/Badge'
import { JobStatusBadge } from '@/components/shared/JobStatusBadge'
import { isActiveStatus, ARCHIVED_ALT_LABEL, syntheticOpenLabel } from '@/lib/config/jobStrategy'
import { isGenuine, jobDetailHref } from '@/lib/jobs/provenance'
import { formatSalary, formatDate } from '@/lib/utils/formatters'
import { ApplicationModal } from './ApplicationModal'
import { JobLinkPendingDot } from './JobLinkPendingDot'

interface JobCardProps { job: Job; onSave?: (id: string) => void }

export function JobCard({ job, onSave }: JobCardProps) {
  const initials = job.company?.slice(0, 2).toUpperCase() || 'NJ'
  const isArchived = job.jobStatus === 'ARCHIVED_JOB'
  const genuine = isGenuine(job)
  // Any currently-open role may present a live "Apply Now" action — synthetic
  // rows collect resumes into the same pipeline as genuine ones (by design;
  // see src/lib/jobs/provenance.ts for what stays genuine-gated: indexing,
  // schema, counting, and the "Verified" trust badge).
  const canApply = isActiveStatus(job.jobStatus)
  // Only genuine jobs get a crawlable internal link to their detail page; for
  // synthetic/demo rows this is null so no dofollow discovery link is emitted.
  const detailHref = jobDetailHref('private', job)
  // Non-genuine cards stay interactive via a "Similar Jobs" path to the (real,
  // indexable) category listing — never a link to a synthetic detail URL.
  const similarHref = `/jobs/private${job.cat ? `?category=${encodeURIComponent(job.cat)}` : ''}`
  const [applyOpen, setApplyOpen] = useState(false)
  const [applied, setApplied] = useState(false)
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '18px 20px', transition: 'all .2s', boxShadow: '0 2px 12px rgba(24,71,212,.06)' }}
      className="hover:shadow-card-hover hover:-translate-y-0.5">
      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        {/* Logo */}
        <div style={{ width: 52, height: 52, borderRadius: 12, background: job.color || '#1847d4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <Link href={detailHref || similarHref}
              style={{ fontFamily: 'Playfair Display,serif', fontWeight: 800, fontSize: 16, color: '#0d1f4e', textDecoration: 'none', lineHeight: 1.3, display: 'block' }}
              className="hover:text-noble-blue">
              {job.title}
              <JobLinkPendingDot />
            </Link>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              {job.jobStatus && (
                <JobStatusBadge
                  status={job.jobStatus}
                  label={
                    !genuine && !isArchived
                      ? syntheticOpenLabel(job.id)
                      : isArchived && parseInt(job.id.replace(/\D/g, ''), 10) % 2 === 0
                        ? ARCHIVED_ALT_LABEL
                        : undefined
                  }
                />
              )}
              {!isArchived && genuine && job.badge && <Badge variant={job.badge === 'Hot' ? 'hot' : 'new'}>{job.badge}</Badge>}
            </div>
          </div>
          <div style={{ fontSize: 13.5, color: '#374151', fontWeight: 600, marginTop: 2 }}>{job.company}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[
          { icon: '📍', label: job.location },
          { icon: '💼', label: job.type || job.job_type || 'Full Time' },
          { icon: '📊', label: job.exp || 'Any Experience' },
          { icon: '💰', label: job.salary || formatSalary((job as any).salary_min, (job as any).salary_max) },
        ].map((t, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0f4ff', color: '#374151', padding: '5px 11px', borderRadius: 20, fontSize: 12.5, fontWeight: 600 }}>
            {t.icon} {t.label}
          </span>
        ))}
      </div>
      {job.skills?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {job.skills.slice(0, 4).map(s => (
            <span key={s} style={{ background: '#eff6ff', color: '#1847d4', border: '1px solid #bfdbfe', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{s}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          {isArchived
            ? `🗄 Archived Vacancy · ${job.source || 'Reference'}`
            : !genuine
              ? `🟢 ${syntheticOpenLabel(job.id)}`
              : `${job.source === 'Himalayas (Verified Remote)' ? '🌐 Remote Verified' : '✅ ' + (job.source || 'Verified')} · ${formatDate((job as any).posted_at || job.posted || '')}`}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {onSave && (
            <button onClick={() => onSave(job.id)} style={{ background: 'transparent', border: '1.5px solid #e2e8f0', color: '#6b7280', padding: '7px 12px', borderRadius: 9, fontSize: 18, cursor: 'pointer' }}>🔖</button>
          )}
          {canApply ? (
            <button type="button" onClick={() => setApplyOpen(true)} disabled={applied}
              style={{ background: applied ? '#15803d' : '#1847d4', color: '#fff', padding: '8px 18px', borderRadius: 9, fontWeight: 800, fontSize: 13, border: 'none', cursor: applied ? 'not-allowed' : 'pointer', display: 'inline-block' }}>
              {applied ? 'Applied ✓' : 'Apply Now →'}
            </button>
          ) : (
            <Link href={detailHref || similarHref}
              style={{ background: '#f1f5f9', color: '#64748b', border: '1.5px solid #cbd5e1', padding: '8px 18px', borderRadius: 9, fontWeight: 800, fontSize: 13, textDecoration: 'none', display: 'inline-block' }}>
              {detailHref ? 'View Details' : 'Similar Jobs →'}
              <JobLinkPendingDot />
            </Link>
          )}
        </div>
      </div>

      <ApplicationModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        jobId={job.id}
        board="private"
        title={job.title}
        company={job.company}
        location={job.location}
        salary={job.salary}
        sourceUrl={job.applyUrl || job.apply_url}
        source={job.source}
        onApplied={() => setApplied(true)}
      />
    </div>
  )
}
