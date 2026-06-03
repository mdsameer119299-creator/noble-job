import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { GOVT_QUALIFICATIONS, getQualificationBySlug } from "@/lib/config/govtTaxonomy"
import { getGovtJobsFiltered } from "@/lib/services/govtJobService"
import { GovtListingView } from "@/components/govt/GovtListingView"

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

export function generateStaticParams() {
  return GOVT_QUALIFICATIONS.map(q => ({ slug: q.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const qual = getQualificationBySlug(slug)
  if (!qual) return { title: "Govt Jobs by Qualification — Noble Job" }
  const desc = `Government jobs for ${qual.label} candidates in 2026. Latest ${qual.label} sarkari naukri notifications with eligibility, vacancies and apply links.`
  return buildPageMetadata({
    title: `${qual.label} Govt Jobs 2026 — Sarkari Naukri`,
    description: desc,
    path: `/jobs/govt/qualification/${slug}`,
    keywords: [qual.label, "government jobs by qualification", "sarkari naukri"],
  })
}

export default async function GovtQualificationPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const qual = getQualificationBySlug(slug)
  if (!qual) notFound()

  const page = Number(sp.page || 1)
  const r = getGovtJobsFiltered({
    qualification: slug,
    q: sp.q,
    state: sp.state,
    department: sp.department,
    experience: sp.experience,
    lastDate: sp.lastDate,
    page,
  })

  return (
    <GovtListingView
      kind="jobs"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Govt Jobs", href: "/jobs/govt" },
        { label: `${qual.label} Jobs` },
      ]}
      title={`${qual.label} Government Jobs`}
      description={`Latest government job notifications eligible for ${qual.label} candidates across India.`}
      qualificationSlug={slug}
      items={r.items}
      facets={r.facets}
      total={r.total}
      vacanciesTotal={r.vacanciesTotal}
      page={r.page}
      totalPages={r.totalPages}
      basePath={`/jobs/govt/qualification/${slug}`}
      query={sp}
      hideFilters={["qualification"]}
    />
  )
}
