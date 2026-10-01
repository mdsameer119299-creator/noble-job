'use client'

import { useState } from 'react'
import type { WfhJob } from '@/types/wfhJob'
import { WfhSkillTags } from './WfhSkillTags'
import { JobStatusBadge } from '@/components/shared/JobStatusBadge'
import { isActiveStatus, ARCHIVED_ALT_LABEL, nonGenuineListingLabel } from '@/lib/config/jobStrategy'
import { classifyProvenance, hasVerifiedTrust, isGenuine } from '@/lib/jobs/provenance'
import { isActionableJob, displayValue } from '@/lib/jobs/renderable'
import { applyStateFor } from '@/lib/jobs/applyRoute'
import { ApplicationModal } from '@/components/jobs/ApplicationModal'

interface WfhJobCardProps {
  job: WfhJob
  onClick: (j: WfhJob) => void
}

export function WfhJobCard({ job, onClick }: WfhJobCardProps) {
  const isArchived = job.jobStatus === 'ARCHIVED_JOB'
  const genuine = isGenuine(job)
  // Same gate as the Private board's JobCard: only a currently-open, genuine,
  // EMPLOYER-OWNED job (never a sample, never an aggregated/sourced listing)
  // may show "Apply Now" directly on the card. Everything else keeps the
  // existing "View Details" control, which still opens the detail modal where
  // the honest apply state (employer / external / sample / closed / listing)
  // is shown via the same `applyStateFor` + `ApplyButton`.
  const isSample = classifyProvenance(job) === 'SYNTHETIC'
  const apply = applyStateFor('wfh', job, job.company)
  const canApply = isActiveStatus(job.jobStatus) && !isSample && apply.kind === 'employer' && isActionableJob(job, 'wfh')
  const [applyOpen, setApplyOpen] = useState(false)
  const [applied, setApplied] = useState(false)

  return (
    // ApplicationModal is portaled (renders into document.body) but a portal's
    // click events still bubble through the REACT tree, not the DOM tree — so if
    // the modal were a child of this onClick'd article, clicking inside it (a
    // form field, its own close button) would also fire onClick(job) and pop the
    // detail modal open on top of it. Rendered as a SIBLING in a fragment instead,
    // so it is outside this article's event-bubbling path entirely.
    <>
    <article className="wfh-job-card" onClick={() => onClick(job)} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onClick(job) }}>
      <div className="wfh-job-card__head">
        <div className="wfh-job-card__logo" style={{ background: job.color || '#7c3aed' }}>
          {job.logo || String(job.company ?? '').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <h3 className="wfh-job-card__title">{job.title}</h3>
            <div className="wfh-job-card__badges">
              {job.jobStatus && (
                <JobStatusBadge
                  status={!genuine && !isArchived ? 'ARCHIVED_JOB' : job.jobStatus}
                  label={
                    !genuine && !isArchived
                      ? nonGenuineListingLabel(job)
                      : isArchived && parseInt(job.id.replace(/\D/g, ''), 10) % 2 === 0
                        ? ARCHIVED_ALT_LABEL
                        : undefined
                  }
                />
              )}
              {!isArchived && genuine && job.badge && (
                <span
                  style={{
                    background: job.badge_type === 'hot' ? '#ef4444' : '#1847d4',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {job.badge}
                </span>
              )}
            </div>
          </div>
          <div className="wfh-job-card__company">{job.company}</div>
        </div>
      </div>

      <div className="wfh-job-card__meta">
        {[
          { i: '🏠', v: displayValue(job.type) },
          { i: '📊', v: displayValue(job.experience) },
          { i: '💰', v: displayValue(job.salary) },
          { i: '📂', v: displayValue(job.cat) },
        ].filter(t => t.v).map((t, i) => (
          <span key={i} className="wfh-job-card__meta-tag">{t.i} {t.v}</span>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <WfhSkillTags skills={job.skills} />
      </div>

      <div className="wfh-job-card__footer">
        <span className="wfh-job-card__applicants">
          {isArchived
            ? '🗄 Archived Vacancy'
            : !genuine
              ? `📄 ${nonGenuineListingLabel(job)}`
              : [
                  Number.isFinite(job.applicants) && job.applicants > 0 ? `👤 ${job.applicants} applicants` : '',
                  hasVerifiedTrust(job) ? 'Verified' : '',
                ].filter(Boolean).join(' · ')}
        </span>
        {canApply ? (
          <button
            type="button"
            className="wfh-job-card__cta"
            disabled={applied}
            onClick={e => { e.stopPropagation(); setApplyOpen(true) }}
          >
            {applied ? 'Applied ✓' : 'Apply Now →'}
          </button>
        ) : (
          <button
            type="button"
            className={`wfh-job-card__cta${isArchived ? ' wfh-job-card__cta--archived' : ''}`}
            onClick={e => { e.stopPropagation(); onClick(job) }}
          >
            View Details
          </button>
        )}
      </div>
    </article>

    <ApplicationModal
      open={applyOpen}
      onClose={() => setApplyOpen(false)}
      jobId={job.id}
      board="wfh"
      title={job.title}
      company={job.company}
      salary={job.salary}
      onApplied={() => setApplied(true)}
    />
    </>
  )
}
