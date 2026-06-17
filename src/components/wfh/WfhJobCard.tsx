'use client'

import type { WfhJob } from '@/types/wfhJob'
import { WfhSkillTags } from './WfhSkillTags'
import { JobStatusBadge } from '@/components/shared/JobStatusBadge'
import { ARCHIVED_ALT_LABEL } from '@/lib/config/jobStrategy'

interface WfhJobCardProps {
  job: WfhJob
  onClick: (j: WfhJob) => void
}

export function WfhJobCard({ job, onClick }: WfhJobCardProps) {
  const isArchived = job.jobStatus === 'ARCHIVED_JOB'

  return (
    <article className="wfh-job-card" onClick={() => onClick(job)} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onClick(job) }}>
      <div className="wfh-job-card__head">
        <div className="wfh-job-card__logo" style={{ background: job.color || '#7c3aed' }}>
          {job.logo || job.company.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <h3 className="wfh-job-card__title">{job.title}</h3>
            <div className="wfh-job-card__badges">
              {job.jobStatus && (
                <JobStatusBadge
                  status={job.jobStatus}
                  label={
                    isArchived && parseInt(job.id.replace(/\D/g, ''), 10) % 2 === 0
                      ? ARCHIVED_ALT_LABEL
                      : undefined
                  }
                />
              )}
              {!isArchived && job.badge && (
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
          { l: '🏠 ' + job.type },
          { l: '📊 ' + job.experience },
          { l: '💰 ' + job.salary },
          { l: '📂 ' + job.cat },
        ].map((t, i) => (
          <span key={i} className="wfh-job-card__meta-tag">{t.l}</span>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <WfhSkillTags skills={job.skills} />
      </div>

      <div className="wfh-job-card__footer">
        <span className="wfh-job-card__applicants">
          {isArchived ? '🗄 Archived Vacancy' : `👤 ${job.applicants} applicants · Verified`}
        </span>
        <button
          type="button"
          className={`wfh-job-card__cta${isArchived ? ' wfh-job-card__cta--archived' : ''}`}
          onClick={e => { e.stopPropagation(); onClick(job) }}
        >
          View Details
        </button>
      </div>
    </article>
  )
}
