import Link from "next/link"
import { Breadcrumbs } from "@/components/shared/Breadcrumbs"
import { JsonLd } from "@/components/seo/JsonLd"
import { faqPageSchema } from "@/lib/seo/schema"
import type { LandingView, LandingSection, LandingJobCard } from "@/lib/seo/landingTypes"
import type { LandingJobBlocks } from "@/lib/seo/landing"

const para = { color: "#374151", fontSize: 14.8, lineHeight: 1.85, marginBottom: 12 } as const
const listStyle = { margin: 0, paddingLeft: 20, color: "#374151", fontSize: 14.8, lineHeight: 1.95 } as const

function Card({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "22px 24px", marginBottom: 16, scrollMarginTop: 80 }}>
      {children}
    </section>
  )
}

function H2({ icon, children }: { icon?: string; children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "Playfair Display,serif", fontWeight: 900, color: "#0d1f4e", fontSize: 20, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
      {icon && <span aria-hidden style={{ color: "#1847d4" }}>{icon}</span>} {children}
    </h2>
  )
}

function SectionBlock({ s }: { s: LandingSection }) {
  return (
    <Card id={s.id}>
      <H2 icon={s.icon}>{s.title}</H2>
      {s.paragraphs?.map((p, i) => <p key={i} style={para}>{p}</p>)}
      {s.bullets && <ul style={listStyle}>{s.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
      {s.steps && <ol style={listStyle}>{s.steps.map((b, i) => <li key={i}>{b}</li>)}</ol>}
      {s.chips && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: s.paragraphs ? 6 : 0 }}>
          {s.chips.map((c, i) => (
            <span key={i} style={{ background: "#eff6ff", color: "#1847d4", border: "1px solid #bfdbfe", padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{c}</span>
          ))}
        </div>
      )}
      {s.table && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.8, marginTop: s.paragraphs ? 8 : 0 }}>
          <thead>
            <tr style={{ background: "#f0f4ff", textAlign: "left" }}>
              <th style={{ padding: "10px 12px", color: "#0d1f4e" }}>{s.table.head[0]}</th>
              <th style={{ padding: "10px 12px", color: "#0d1f4e" }}>{s.table.head[1]}</th>
            </tr>
          </thead>
          <tbody>
            {s.table.rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0d1f4e" }}>{r[0]}</td>
                <td style={{ padding: "10px 12px", color: "#374151" }}>{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

function JobBlock({ title, icon, jobs, ctaHref, ctaLabel, accent }: { title: string; icon: string; jobs: LandingJobCard[]; ctaHref: string; ctaLabel: string; accent: string }) {
  if (!jobs.length) return null
  return (
    <Card>
      <H2 icon={icon}>{title}</H2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
        {jobs.map((j, i) => (
          // Genuine rows link to their detail page; non-genuine rows (href null)
          // fall back to the section hub ("browse similar") — a real, indexable
          // page, never a synthetic detail URL — so no card is inert.
          <Link key={i} href={j.href ?? ctaHref} style={{ display: "block", textDecoration: "none", background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 11, padding: "13px 15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14, lineHeight: 1.35 }}>{j.title}</span>
              {j.badge && <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 7px", borderRadius: 8, fontSize: 10.5, fontWeight: 800, border: "1px solid #86efac", flexShrink: 0 }}>{j.badge}</span>}
            </div>
            <div style={{ color: "#475569", fontSize: 12.5, fontWeight: 600, marginTop: 3 }}>{j.company}</div>
            {j.meta && <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{j.meta}</div>}
          </Link>
        ))}
      </div>
      <Link href={ctaHref} style={{ display: "inline-block", marginTop: 14, background: accent, color: "#fff", padding: "10px 18px", borderRadius: 9, fontWeight: 800, fontSize: 13.5, textDecoration: "none" }}>{ctaLabel} →</Link>
    </Card>
  )
}

export function LandingPage({ view, jobs }: { view: LandingView; jobs: LandingJobBlocks }) {
  return (
    <div style={{ background: "#f8faff", minHeight: "100vh" }}>
      <JsonLd data={faqPageSchema(view.faqs.map(f => ({ question: f.q, answer: f.a })))} />

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg,${view.accent},#0d1f4e)`, padding: "30px 0 34px" }}>
        <div className="wrap">
          <Breadcrumbs items={view.breadcrumb} />
          <h1 style={{ fontFamily: "Playfair Display,serif", fontSize: "clamp(25px,3.2vw,36px)", fontWeight: 900, color: "#fff", marginBottom: 10, lineHeight: 1.18 }}>{view.h1}</h1>
          <p style={{ color: "rgba(255,255,255,.88)", fontSize: 16, marginBottom: 14, maxWidth: 760 }}>{view.heroSubtitle}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {view.heroBadges.map((b, i) => (
              <span key={i} style={{ background: "rgba(255,255,255,.15)", padding: "5px 13px", borderRadius: 16, fontSize: 12.5, color: "#fff", fontWeight: 600 }}>{b}</span>
            ))}
          </div>
          <Link href={view.jobsHref} style={{ display: "inline-block", background: "#fff", color: "#0d1f4e", padding: "11px 22px", borderRadius: 10, fontWeight: 900, fontSize: 14.5, textDecoration: "none" }}>{view.jobsLabel} →</Link>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 24, alignItems: "flex-start" }} className="max-lg:!grid-cols-1">
          {/* Main */}
          <div>
            <Card>
              {view.intro.map((p, i) => <p key={i} style={{ ...para, marginBottom: i === view.intro.length - 1 ? 0 : 12 }}>{p}</p>)}
            </Card>

            <JobBlock title="Latest Jobs" icon="🆕" jobs={jobs.latest} ctaHref={view.jobsHref} ctaLabel={view.jobsLabel} accent={view.accent} />

            {view.sections.slice(0, 2).map(s => <SectionBlock key={s.id} s={s} />)}

            <JobBlock title="Trending Jobs" icon="🔥" jobs={jobs.trending} ctaHref={view.jobsHref} ctaLabel="View More Jobs" accent={view.accent} />

            {view.sections.slice(2).map(s => <SectionBlock key={s.id} s={s} />)}

            {/* FAQ */}
            <Card id="faqs">
              <H2 icon="❓">Frequently Asked Questions</H2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {view.faqs.map((f, i) => (
                  <div key={i}>
                    <div style={{ fontWeight: 700, color: "#0d1f4e", fontSize: 14.4, marginBottom: 4 }}>Q{i + 1}. {f.q}</div>
                    <div style={{ color: "#374151", fontSize: 13.9, lineHeight: 1.75 }}>{f.a}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Related categories + cities */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
              <Card>
                <H2 icon="🧭">Related Job Categories</H2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {view.relatedCategories.map((l, i) => (
                    <Link key={i} href={l.href} style={{ color: "#1847d4", fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>→ {l.label}</Link>
                  ))}
                </div>
              </Card>
              <Card>
                <H2 icon="📍">Jobs in Other Cities</H2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {view.relatedCities.map((l, i) => (
                    <Link key={i} href={l.href} style={{ color: "#1847d4", fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>→ {l.label}</Link>
                  ))}
                </div>
              </Card>
            </div>

            {/* Related Guides — reciprocal hub -> guide links (topical-authority silo) */}
            {view.relatedGuides.length > 0 && (
              <Card>
                <H2 icon="📚">Related Guides &amp; Career Advice</H2>
                <p style={{ ...para, marginBottom: 12 }}>
                  Go deeper with our free, expert guides for this category:
                </p>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {view.relatedGuides.map((g, i) => (
                    <li key={i}>
                      <Link href={g.href} style={{ color: "#1847d4", fontWeight: 700, fontSize: 14.5, textDecoration: "none", display: "inline-flex", gap: 6 }}>
                        <span aria-hidden>→</span> {g.anchor}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href="/guides" style={{ display: "inline-block", marginTop: 12, color: "#6b7280", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>Browse all career &amp; job guides →</Link>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "18px 16px", position: "sticky", top: 16 }}>
              <h3 style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14.5, marginBottom: 12 }}>Start Your Job Search</h3>
              <Link href={view.jobsHref} style={{ display: "block", background: view.accent, color: "#fff", padding: "11px 14px", borderRadius: 9, fontWeight: 800, fontSize: 13.5, textDecoration: "none", textAlign: "center", marginBottom: 10 }}>{view.jobsLabel}</Link>
              <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", margin: 0 }}>Noble Job never charges candidates to apply.</p>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "18px 16px" }}>
              <h3 style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14, marginBottom: 12 }}>Explore Categories</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Government Jobs", href: "/government-jobs" },
                  { label: "Private Jobs", href: "/private-jobs" },
                  { label: "Work From Home Jobs", href: "/work-from-home-jobs" },
                  { label: "Jobs Abroad", href: "/jobs-abroad" },
                  { label: "Fresher Jobs", href: "/fresher-jobs" },
                ].filter(l => l.href !== `/${view.slug}`).map((l, i) => (
                  <Link key={i} href={l.href} style={{ color: "#1847d4", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>→ {l.label}</Link>
                ))}
                {view.govtStateLink && (
                  <Link href={view.govtStateLink.href} style={{ color: "#1847d4", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>→ {view.govtStateLink.label}</Link>
                )}
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "18px 16px" }}>
              <h3 style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14, marginBottom: 12 }}>Popular Cities</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {view.relatedCities.map((l, i) => (
                  <Link key={i} href={l.href} style={{ color: "#1847d4", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>→ {l.label}</Link>
                ))}
              </div>
            </div>

            <Link href="/" style={{ textAlign: "center", color: "#1847d4", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>← Back to Noble Job Home</Link>
          </aside>
        </div>
      </div>
    </div>
  )
}
