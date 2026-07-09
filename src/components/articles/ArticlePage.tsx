import Link from "next/link"
import { Breadcrumbs } from "@/components/shared/Breadcrumbs"
import { JsonLd } from "@/components/seo/JsonLd"
import { articleSchema, faqPageSchema } from "@/lib/seo/schema"
import type { ArticleView, LandingSection } from "@/lib/seo/articleTypes"
import type { LandingJobCard } from "@/lib/seo/landingTypes"

const para = { color: "#374151", fontSize: 15, lineHeight: 1.85, marginBottom: 12 } as const
const listStyle = { margin: 0, paddingLeft: 20, color: "#374151", fontSize: 14.8, lineHeight: 1.95 } as const

function Card({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "22px 24px", marginBottom: 16, scrollMarginTop: 80 }}>
      {children}
    </section>
  )
}

function H2({ icon, children }: { icon?: string; children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "Playfair Display,serif", fontWeight: 900, color: "#0d1f4e", fontSize: 21, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
      {icon && <span aria-hidden style={{ color: "#1847d4" }}>{icon}</span>} {children}
    </h2>
  )
}

function SectionBlock({ s }: { s: LandingSection }) {
  return (
    <Card id={s.id}>
      <H2 icon={s.icon}>{s.title}</H2>
      {s.paragraphs?.map((p, i) => <p key={i} style={para}>{p}</p>)}
      {s.bullets && <ul style={listStyle}>{s.bullets.map((b, i) => <li key={i} style={{ marginBottom: 4 }}>{b}</li>)}</ul>}
      {s.steps && <ol style={listStyle}>{s.steps.map((b, i) => <li key={i} style={{ marginBottom: 4 }}>{b}</li>)}</ol>}
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

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
}

export function ArticlePage({ view, jobs }: { view: ArticleView; jobs: LandingJobCard[] }) {
  const articleUrl = `/guides/${view.slug}`
  const metaDesc = view.intro[0]?.slice(0, 200) || view.heroSubtitle

  return (
    <div style={{ background: "#f8faff", minHeight: "100vh" }}>
      <JsonLd
        data={[
          articleSchema({
            headline: view.title,
            description: metaDesc,
            url: articleUrl,
            datePublished: view.datePublished,
            dateModified: view.dateModified,
            section: view.clusterLabel,
          }),
          faqPageSchema(view.faqs.map(f => ({ question: f.q, answer: f.a }))),
        ]}
      />

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg,${view.accent},#0d1f4e)`, padding: "30px 0 34px" }}>
        <div className="wrap" style={{ maxWidth: 1100 }}>
          <Breadcrumbs items={view.breadcrumb} />
          <div style={{ display: "inline-block", background: "rgba(255,255,255,.15)", padding: "4px 12px", borderRadius: 18, fontSize: 12, color: "#e0e8ff", fontWeight: 700, marginBottom: 10 }}>
            {view.clusterLabel}
          </div>
          <h1 style={{ fontFamily: "Playfair Display,serif", fontSize: "clamp(25px,3.2vw,36px)", fontWeight: 900, color: "#fff", marginBottom: 10, lineHeight: 1.18 }}>{view.title}</h1>
          <p style={{ color: "rgba(255,255,255,.88)", fontSize: 16, marginBottom: 12, maxWidth: 780 }}>{view.heroSubtitle}</p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: "rgba(255,255,255,.75)", fontSize: 12.5 }}>
            <span>📖 {view.readMinutes} min read</span>
            <span>🗓 Updated {fmtDate(view.dateModified)}</span>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 24, alignItems: "flex-start" }} className="max-lg:!grid-cols-1">
          {/* Main */}
          <article>
            <Card>
              {view.intro.map((p, i) => <p key={i} style={{ ...para, marginBottom: i === view.intro.length - 1 ? 0 : 12 }}>{p}</p>)}
            </Card>

            {view.sections.map(s => <SectionBlock key={s.id} s={s} />)}

            {/* Latest Opportunities */}
            {jobs.length > 0 && (
              <Card id="latest-opportunities">
                <H2 icon="🆕">Latest Opportunities</H2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
                  {jobs.map((j, i) => (
                    // Genuine → detail page; non-genuine (href null) → section hub
                    // ("browse similar"), a real indexable page, never a synthetic
                    // detail URL. No card is left inert.
                    <Link key={i} href={j.href ?? view.jobsHref} style={{ display: "block", textDecoration: "none", background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 11, padding: "13px 15px" }}>
                      <span style={{ display: "block", fontWeight: 800, color: "#0d1f4e", fontSize: 14, lineHeight: 1.35 }}>{j.title}</span>
                      <span style={{ display: "block", color: "#475569", fontSize: 12.5, fontWeight: 600, marginTop: 3 }}>{j.company}</span>
                      {j.meta && <span style={{ display: "block", color: "#6b7280", fontSize: 12, marginTop: 2 }}>{j.meta}</span>}
                    </Link>
                  ))}
                </div>
                <Link href={view.jobsHref} style={{ display: "inline-block", marginTop: 14, background: view.accent, color: "#fff", padding: "10px 18px", borderRadius: 9, fontWeight: 800, fontSize: 13.5, textDecoration: "none" }}>{view.jobsLabel} →</Link>
              </Card>
            )}

            {/* FAQ */}
            <Card id="faqs">
              <H2 icon="❓">Frequently Asked Questions</H2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {view.faqs.map((f, i) => (
                  <div key={i}>
                    <div style={{ fontWeight: 700, color: "#0d1f4e", fontSize: 14.6, marginBottom: 4 }}>Q{i + 1}. {f.q}</div>
                    <div style={{ color: "#374151", fontSize: 14, lineHeight: 1.75 }}>{f.a}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* CTA */}
            <Card>
              <H2 icon="🎯">Take the Next Step</H2>
              {view.cta.map((p, i) => <p key={i} style={{ ...para, marginBottom: 14 }}>{p}</p>)}
              <Link href={view.jobsHref} style={{ display: "inline-block", background: view.accent, color: "#fff", padding: "12px 24px", borderRadius: 10, fontWeight: 900, fontSize: 14.5, textDecoration: "none" }}>{view.jobsLabel} →</Link>
            </Card>

            {/* Related guides (silo cross-linking) */}
            {view.relatedArticles.length > 0 && (
              <Card>
                <H2 icon="🔗">Related Guides</H2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {view.relatedArticles.map((a, i) => (
                    <Link key={i} href={a.href} style={{ color: "#1847d4", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>→ {a.title}</Link>
                  ))}
                  <Link href="/guides" style={{ color: "#6b7280", fontWeight: 700, fontSize: 13, textDecoration: "none", marginTop: 4 }}>View all career & job guides →</Link>
                </div>
              </Card>
            )}
          </article>

          {/* Sidebar */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "18px 16px", position: "sticky", top: 16 }}>
              <h3 style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14.5, marginBottom: 12 }}>Find Jobs Now</h3>
              <Link href={view.jobsHref} style={{ display: "block", background: view.accent, color: "#fff", padding: "11px 14px", borderRadius: 9, fontWeight: 800, fontSize: 13.5, textDecoration: "none", textAlign: "center", marginBottom: 10 }}>{view.jobsLabel}</Link>
              <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", margin: 0 }}>Noble Job never charges candidates to apply.</p>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "18px 16px" }}>
              <h3 style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14, marginBottom: 12 }}>Explore Job Hubs</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {view.hubLinks.map((l, i) => (
                  <Link key={i} href={l.href} style={{ color: "#1847d4", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>→ {l.label}</Link>
                ))}
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "18px 16px" }}>
              <h3 style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14, marginBottom: 12 }}>Browse Listings</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {view.listingLinks.map((l, i) => (
                  <Link key={i} href={l.href} style={{ color: "#1847d4", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>→ {l.label}</Link>
                ))}
              </div>
            </div>

            <Link href="/guides" style={{ textAlign: "center", color: "#1847d4", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>← All Guides</Link>
          </aside>
        </div>
      </div>
    </div>
  )
}
