'use client'
import type { AbroadJob } from '@/types/abroadJob'
import { classifyProvenance } from '@/lib/jobs/provenance'
import { ApplyButton } from '@/components/jobs/ApplyButton'

interface AbroadApplySlotProps { job: AbroadJob }

/**
 * Abroad jobs split into two apply workflows depending on provenance:
 * AGGREGATED (real third-party feed, e.g. a trusted API) sends the candidate
 * to the employer's own career site — Noble Job never collects a resume for
 * those. Everything else that can apply (EMPLOYER-posted, or SYNTHETIC while
 * visible) uses Noble Job's internal application + resume-collection flow,
 * same as private/WFH.
 */
export function AbroadApplySlot({ job }: AbroadApplySlotProps) {
  const isAggregated = classifyProvenance(job) === 'AGGREGATED'

  if (isAggregated) {
    return (
      <div>
        <a
          href={job.apply_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            background: 'linear-gradient(135deg,#0369a1,#0d1f4e)',
            color: '#fff',
            padding: '13px',
            borderRadius: 10,
            fontWeight: 900,
            textDecoration: 'none',
            textAlign: 'center',
            fontSize: 15,
          }}
        >
          Apply on Official Career Page →
        </a>
        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
          You are being redirected to the employer&apos;s official career portal.
        </p>
      </div>
    )
  }

  return (
    <ApplyButton
      jobId={job.id}
      board="abroad"
      applyUrl={job.apply_url}
      title={job.title}
      company={job.company}
      location={job.location || job.country}
      salary={job.salary}
    />
  )
}
