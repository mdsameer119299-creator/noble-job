import type { Metadata } from "next"
import Link from "next/link"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { Breadcrumbs } from "@/components/shared/Breadcrumbs"
import { JsonLd } from "@/components/seo/JsonLd"
import { breadcrumbSchema } from "@/lib/seo/schema"
import { articlesByCluster, CLUSTER_META } from "@/lib/seo/articles"
import type { ArticleCluster, ArticleConfig } from "@/lib/seo/articleTypes"

export const revalidate = 86400

export const metadata: Metadata = buildPageMetadata({
  title: "Career & Job Guides 2026 — Government, Private & City Jobs | Noble Job",
  description:
    "Free expert career and job guides for India 2026 — government jobs after 10th/12th & for graduates, resume formats, interview questions, work-from-home jobs and city job guides for Delhi, Gurgaon & Bangalore.",
  path: "/guides",
  keywords: ["career guides", "job guides India", "government jobs guide", "resume tips", "interview questions", "how to get a job"],
})

const CLUSTER_ORDER: { key: ArticleCluster; blurb: string }[] = [
  { key: "government", blurb: "Land a secure sarkari naukri — qualification-wise pathways, eligibility, salary and preparation." },
  { key: "career", blurb: "Win in the private sector — resumes, interviews, remote work and a complete job-search strategy." },
  { key: "city", blurb: "City-by-city playbooks — sectors, hubs, salaries and how to land a job where you live." },
]

const HUBS = [
  { label: "Government Jobs", href: "/government-jobs" },
  { label: "Private Jobs", href: "/private-jobs" },
  { label: "Work From Home Jobs", href: "/work-from-home-jobs" },
  { label: "Fresher Jobs", href: "/fresher-jobs" },
  { label: "Free Resume Analyzer", href: "/upload-resume" },
  { label: "Jobs in Delhi", href: "/jobs-in-delhi" },
  { label: "Jobs in Gurgaon", href: "/jobs-in-gurgaon" },
  { label: "Jobs in Bangalore", href: "/jobs-in-bangalore" },
]

function ArticleCard({ a }: { a: ArticleConfig }) {
  return (
    <Link href={`/guides/${a.slug}`} style={{ display: "block", textDecoration: "none", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "18px 20px", height: "100%" }}>
      <div style={{ fontFamily: "Playfair Display,serif", fontWeight: 900, color: "#0d1f4e", fontSize: 16.5, lineHeight: 1.3, marginBottom: 6 }}>{a.title}</div>
      <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>{a.heroSubtitle}</div>
      <span style={{ color: "#1847d4", fontWeight: 800, fontSize: 13 }}>Read guide →</span>
    </Link>
  )
}

export default function GuidesIndexPage() {
  const crumbs = [{ label: "Home", href: "/" }, { label: "Guides" }]
  return (
    <div style={{ background: "#f8faff", minHeight: "100vh" }}>
      <JsonLd data={breadcrumbSchema(crumbs.map(c => ({ name: c.label, path: c.href })))} />

      <div style={{ background: "linear-gradient(135deg,#0d1f4e,#1847d4)", padding: "32px 0 36px" }}>
        <div className="wrap">
          <Breadcrumbs items={crumbs} />
          <h1 style={{ fontFamily: "Playfair Display,serif", fontSize: "clamp(26px,3.4vw,38px)", fontWeight: 900, color: "#fff", marginBottom: 10 }}>
            Career &amp; Job Guides
          </h1>
          <p style={{ color: "rgba(255,255,255,.88)", fontSize: 16, maxWidth: 760 }}>
            Expert, up-to-date guides to help you find, prepare for and land the right job — government, private, remote and city-by-city.
          </p>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 28, paddingBottom: 48 }}>
        {CLUSTER_ORDER.map(({ key, blurb }) => {
          const articles = articlesByCluster(key)
          if (!articles.length) return null
          return (
            <section key={key} style={{ marginBottom: 36 }}>
              <h2 style={{ fontFamily: "Playfair Display,serif", fontWeight: 900, color: "#0d1f4e", fontSize: 22, marginBottom: 4 }}>{CLUSTER_META[key].label}</h2>
              <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>{blurb}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
                {articles.map(a => <ArticleCard key={a.slug} a={a} />)}
              </div>
            </section>
          )
        })}

        <section style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "22px 24px" }}>
          <h2 style={{ fontFamily: "Playfair Display,serif", fontWeight: 900, color: "#0d1f4e", fontSize: 20, marginBottom: 12 }}>Browse Job Hubs</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {HUBS.map(h => (
              <Link key={h.href} href={h.href} style={{ background: "#eff6ff", color: "#1847d4", border: "1px solid #bfdbfe", padding: "8px 16px", borderRadius: 20, fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>{h.label}</Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
