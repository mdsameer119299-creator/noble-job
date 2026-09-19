'use client'
import type { AbroadJob } from '@/types/abroadJob'
import { classifyProvenance } from '@/lib/jobs/provenance'
import { applyRouteFor } from '@/lib/jobs/applyRoute'
import { ApplyButton } from '@/components/jobs/ApplyButton'

interface AbroadApplySlotProps { job: AbroadJob }

/**
 * Abroad jobs split into two apply workflows depending on provenance:
 * AGGREGATED (real third-party feed, e.g. a trusted API) sends the candidate
 * to the employer's own career site — Noble Job never collects a resume for
 * those. Everything else that can apply (EMPLOYER-posted) uses Noble Job's internal application + resume-collection flow,
 * same as private/WFH. SYNTHETIC (demo) listings show an unavailable state.
 */
export function AbroadApplySlot({ job }: AbroadApplySlotProps) {
  // Same decision JobPosting eligibility uses (lib/jobs/applyRoute.ts): the external
  // career-page link appears ONLY for a genuine AGGREGATED job with a real URL — never
  // an href="#" — so the page and its structured data can never disagree about Apply.
  const isExternal = applyRouteFor('abroad', job) === 'external'

  if (isExternal) {
    return (
      <div>
        <a
          href={job.apply_url}
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
      sample={classifyProvenance(job) === 'SYNTHETIC'}
    />
  )
}
