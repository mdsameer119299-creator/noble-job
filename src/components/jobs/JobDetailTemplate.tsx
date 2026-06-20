import Link from "next/link"
import { Breadcrumbs, type Crumb } from "@/components/shared/Breadcrumbs"
import { JsonLd } from "@/components/seo/JsonLd"
import { faqPageSchema } from "@/lib/seo/schema"
import type { JobContent } from "@/lib/seo/jobContent"

export interface JobLink {
  href: string
  title: string
  meta?: string
}

export interface InternalLink {
  href: string
  label: string
}

export interface JobDetailTemplateProps {
  accent: string
  breadcrumb: Crumb[]
  title: string
  subtitle: string
  badges: string[]
  content: JobContent
  /** Board-specific apply UI (button / link) rendered in the sticky sidebar. */
  applySlot: React.ReactNode
  /** JobPosting JSON-LD for this job. */
  jsonLdSlot: React.ReactNode
  internalLinks: {
    category: InternalLink
    city?: InternalLink
    list: InternalLink
    extra?: InternalLink[]
  }
  relatedTitle: string
  relatedJobs: JobLink[]
  govtSuggestions: JobLink[]
  privateSuggestions: JobLink[]
  citySuggestions?: { title: string; links: JobLink[] }
}

function Section({ id, title, icon, children }: { id: string; title: string; icon: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "22px 24px", marginBottom: 16, scrollMarginTop: 80 }}>
      <h2 style={{ fontFamily: "Playfair Display,serif", fontWeight: 900, color: "#0d1f4e", fontSize: 19, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden>{icon}</span> {title}
      </h2>
      {children}
    </section>
  )
}

const para = { color: "#374151", fontSize: 14.5, lineHeight: 1.8, marginBottom: 12 } as const
const bulletList = { margin: 0, paddingLeft: 20, color: "#374151", fontSize: 14.5, lineHeight: 1.9 } as const

function LinkList({ jobs }: { jobs: JobLink[] }) {
  if (!jobs.length) return <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>More openings are being added — check back soon.</p>
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {jobs.map((j, i) => (
        <li key={`${j.href}-${i}`}>
          <Link href={j.href} style={{ display: "block", textDecoration: "none", background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 9, padding: "9px 12px" }}>
            <span style={{ display: "block", fontWeight: 700, color: "#0d1f4e", fontSize: 13.2, lineHeight: 1.35 }}>{j.title}</span>
            {j.meta && <span style={{ display: "block", color: "#6b7280", fontSize: 11.5, marginTop: 2 }}>{j.meta}</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function JobDetailTemplate(props: JobDetailTemplateProps) {
  const { content, accent, internalLinks } = props

  return (
    <div style={{ background: "#f8faff", minHeight: "100vh" }}>
      {props.jsonLdSlot}
      <JsonLd data={faqPageSchema(content.faqs.map(f => ({ question: f.q, answer: f.a })))} />

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg,${accent},#0d1f4e)`, padding: "28px 0 32px" }}>
        <div className="wrap">
          <Breadcrumbs items={props.breadcrumb} />
          <h1 style={{ fontFamily: "Playfair Display,serif", fontSize: "clamp(24px,3vw,34px)", fontWeight: 900, color: "#fff", marginBottom: 8, lineHeight: 1.2 }}>{props.title}</h1>
          <p style={{ color: "rgba(255,255,255,.85)", fontSize: 15.5, marginBottom: 12 }}>{props.subtitle}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {props.badges.filter(Boolean).map((b, i) => (
              <span key={i} style={{ background: "rgba(255,255,255,.15)", padding: "5px 13px", borderRadius: 16, fontSize: 12.5, color: "#fff", fontWeight: 600 }}>{b}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 24, alignItems: "flex-start" }} className="max-lg:!grid-cols-1">
          {/* Main column */}
          <div>
            <Section id="overview" title="Job Overview" icon="📋">
              {content.overview.map((p, i) => <p key={i} style={para}>{p}</p>)}
            </Section>

            <Section id="about-organization" title="About the Organization" icon="🏢">
              <p style={{ ...para, marginBottom: 0 }}>{content.aboutOrg}</p>
            </Section>

            <Section id="responsibilities" title="Key Responsibilities" icon="✅">
              <ul style={bulletList}>{content.responsibilities.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </Section>

            <Section id="eligibility" title="Eligibility Criteria" icon="🎓">
              <ul style={bulletList}>{content.eligibility.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </Section>

            <Section id="skills" title="Required Skills" icon="🛠️">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {content.skills.map((s, i) => (
                  <span key={i} style={{ background: "#eff6ff", color: "#1847d4", border: "1px solid #bfdbfe", padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{s}</span>
                ))}
              </div>
            </Section>

            <Section id="salary" title="Salary Details" icon="💰">
              <p style={{ ...para, marginBottom: 0 }}>{content.salaryDetails}</p>
            </Section>

            <Section id="benefits" title="Benefits & Perks" icon="🎁">
              <ul style={bulletList}>{content.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </Section>

            <Section id="selection-process" title="Selection Process" icon="🧭">
              <ol style={bulletList}>{content.selectionProcess.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </Section>

            <Section id="how-to-apply" title="How to Apply" icon="📝">
              <ol style={bulletList}>{content.howToApply.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </Section>

            <Section id="important-dates" title="Important Dates" icon="📅">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.8 }}>
                <tbody>
                  {content.importantDates.map((d, i) => (
                    <tr key={i} style={{ borderTop: i ? "1px solid #f1f5f9" : "none" }}>
                      <td style={{ padding: "9px 12px", color: "#374151" }}>{d.label}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: "#0d1f4e" }}>{d.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section id="important-links" title="Important Links" icon="🔗">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
                {[
                  internalLinks.list,
                  internalLinks.category,
                  ...(internalLinks.city ? [internalLinks.city] : []),
                  ...(internalLinks.extra || []),
                  { href: "/", label: "Noble Job Home" },
                ].map((lk, i) => (
                  <Link key={`${lk.href}-${i}`} href={lk.href} style={{ background: "#eff6ff", color: "#1847d4", border: "1px solid #bfdbfe", padding: "11px 16px", borderRadius: 10, fontWeight: 800, fontSize: 13.2, textDecoration: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {lk.label}<span aria-hidden>→</span>
                  </Link>
                ))}
              </div>
            </Section>

            <Section id="faqs" title="Frequently Asked Questions" icon="❓">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {content.faqs.map((f, i) => (
                  <div key={i}>
                    <div style={{ fontWeight: 700, color: "#0d1f4e", fontSize: 14.2, marginBottom: 4 }}>Q{i + 1}. {f.q}</div>
                    <div style={{ color: "#374151", fontSize: 13.8, lineHeight: 1.75 }}>{f.a}</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Cross-board internal linking — keeps deep pages connected. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
              <Section id="similar-govt-jobs" title="Government Job Suggestions" icon="🏛️">
                <LinkList jobs={props.govtSuggestions} />
                <Link href="/jobs/govt" style={{ display: "inline-block", marginTop: 12, color: "#1847d4", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>View all Government Jobs →</Link>
              </Section>
              <Section id="similar-private-jobs" title="Private Job Suggestions" icon="💼">
                <LinkList jobs={props.privateSuggestions} />
                <Link href="/jobs/private" style={{ display: "inline-block", marginTop: 12, color: "#1847d4", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>View all Private Jobs →</Link>
              </Section>
            </div>

            <div style={{ background: "#fffbeb", borderRadius: 10, padding: "14px 16px", fontSize: 12.5, color: "#92400e", border: "1px solid #fcd34d", marginTop: 16 }}>
              ⚠️ Noble Job aggregates and verifies listings but is not the hiring employer. Always confirm role details on the official application page and never pay any fee to apply.
            </div>
          </div>

          {/* Sidebar */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "18px 16px", position: "sticky", top: 16 }}>
              <h3 style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14.5, marginBottom: 12 }}>Apply for this Job</h3>
              {props.applySlot}
              <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 10 }}>Noble Job never charges candidates to apply.</p>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "18px 16px" }}>
              <h3 style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14, marginBottom: 12 }}>🔎 Explore More</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[internalLinks.list, internalLinks.category, ...(internalLinks.city ? [internalLinks.city] : [])].map((lk, i) => (
                  <Link key={i} href={lk.href} style={{ color: "#1847d4", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>→ {lk.label}</Link>
                ))}
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "18px 16px" }}>
              <h3 style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14, marginBottom: 12 }}>🔗 {props.relatedTitle}</h3>
              <LinkList jobs={props.relatedJobs} />
            </div>

            {props.citySuggestions && (
              <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "18px 16px" }}>
                <h3 style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14, marginBottom: 12 }}>📍 {props.citySuggestions.title}</h3>
                <LinkList jobs={props.citySuggestions.links} />
              </div>
            )}

            <Link href="/" style={{ textAlign: "center", color: "#1847d4", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>← Back to Noble Job Home</Link>
          </aside>
        </div>
      </div>
    </div>
  )
}
