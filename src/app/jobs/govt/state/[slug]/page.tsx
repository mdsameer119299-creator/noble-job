import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { INDIAN_STATES, getStateBySlug } from "@/lib/config/govtTaxonomy"
import { getGovtJobsFiltered } from "@/lib/services/govtJobService"
import { GovtListingView } from "@/components/govt/GovtListingView"

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

// DB-driven content regenerates so new govt_jobs rows appear without a redeploy.
export const revalidate = 600
export function generateStaticParams() {
  return INDIAN_STATES.map(s => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const state = getStateBySlug(slug)
  if (!state) return { title: "State Government Jobs — Noble Job" }
  const desc = `Latest ${state.label} government jobs 2026. State govt recruitment, vacancies, eligibility, last date and apply online links for ${state.label}.`
  return buildPageMetadata({
    title: `${state.label} Govt Jobs 2026 — Latest Vacancies`,
    description: desc,
    path: `/jobs/govt/state/${slug}`,
    keywords: [state.label, "state government jobs", "sarkari naukri", "Jobs in India"],
  })
}

export default async function GovtStatePage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const state = getStateBySlug(slug)
  if (!state) notFound()

  const page = Number(sp.page || 1)
  let r = await getGovtJobsFiltered({
    state: slug,
    q: sp.q,
    qualification: sp.qualification,
    department: sp.department,
    experience: sp.experience,
    lastDate: sp.lastDate,
    page,
  })

  // Never show an empty state page: when there are no state-specific
  // recruitments, fall back to the NATIONAL (All-India) pool that this state's
  // candidates are eligible for — clearly labelled as national, never relabelled
  // as the state's own. Same cards/components, no layout change.
  const usedFallback = r.total === 0
  if (usedFallback) r = await getGovtJobsFiltered({ category: "all-india", q: sp.q, page })

  return (
    <GovtListingView
      kind="jobs"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Govt Jobs", href: "/jobs/govt" },
        { label: "State Govt Jobs", href: "/jobs/govt/category/state-govt" },
        { label: state.label },
      ]}
      title={usedFallback
        ? `National Government Jobs Eligible for ${state.label} Candidates`
        : `${state.label} Government Jobs`}
      description={usedFallback
        ? `No ${state.label}-specific government jobs are currently available. Showing national (All-India) government jobs that ${state.label} candidates are eligible to apply for.`
        : `Latest ${state.label} government job notifications — state PSC, boards, police, teaching and departmental recruitment.`}
      stateSlug={slug}
      items={r.items}
      facets={r.facets}
      total={r.total}
      vacanciesTotal={r.vacanciesTotal}
      page={r.page}
      totalPages={r.totalPages}
      basePath={`/jobs/govt/state/${slug}`}
      query={sp}
      hideFilters={["state"]}
    />
  )
}
