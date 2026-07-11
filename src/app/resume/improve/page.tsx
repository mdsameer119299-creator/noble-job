import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { ResumeWorkspaceShell } from '@/components/resume/ResumeWorkspaceShell'

// Resume AI workspace (pre-engine). Kept noindex,nofollow and out of the sitemap
// (the sitemap enumerates a static allowlist that does not include this route).
export const metadata: Metadata = buildPageMetadata({
  title: 'Improve My Resume — Noble Resume AI | Noble Job',
  description: 'Add your resume to Noble Resume AI. A truthful AI audit and rebuild are coming soon; get an instant Career Score meanwhile.',
  path: '/resume/improve',
  noIndex: true,
})

export default function ResumeImprovePage() {
  return <ResumeWorkspaceShell mode="improve" />
}
