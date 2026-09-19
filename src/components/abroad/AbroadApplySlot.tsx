'use client'
import type { AbroadJob } from '@/types/abroadJob'
import { applyStateFor } from '@/lib/jobs/applyRoute'
import { ApplyButton } from '@/components/jobs/ApplyButton'

interface AbroadApplySlotProps { job: AbroadJob }

/**
 * The abroad apply control renders the SAME honest application state as the private
 * and WFH boards (`applyStateFor`, lib/jobs/applyRoute.ts) — the page and its
 * structured data can never disagree about Apply:
 *   employer → NobleJob's on-site flow (the application reaches the owning employer);
 *   external → a link to the genuine source's own application page (never href="#");
 *   sample / closed / listing → no application action.
 */
export function AbroadApplySlot({ job }: AbroadApplySlotProps) {
  const state = applyStateFor('abroad', job, job.company)
  return (
    <ApplyButton
      jobId={job.id}
      board="abroad"
      state={state}
      title={job.title}
      company={job.company}
      location={job.location || job.country}
      salary={job.salary}
    />
  )
}
