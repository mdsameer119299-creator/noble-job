import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { ResumeWorkspaceShell } from '@/components/resume/ResumeWorkspaceShell'

// Resume AI workspace (pre-engine). Kept noindex,nofollow and out of the sitemap
// (the sitemap enumerates a static allowlist that does not include this route).
export const metadata: Metadata = buildPageMetadata({
  title: 'Tailor Your Resume for a Job — Noble Resume AI | Noble Job',
  description: 'Add your resume and a target job to Noble Resume AI. Truthful, fact-based tailoring is coming soon.',
  path: '/resume/tailor',
  noIndex: true,
})

export default function ResumeTailorPage() {
  return <ResumeWorkspaceShell mode="tailor" />
}
