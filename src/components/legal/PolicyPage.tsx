import { Breadcrumbs } from "@/components/shared/Breadcrumbs"
import { SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/seo/constants"

export interface PolicySection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export function PolicyPage({
  title,
  intro,
  updated,
  sections,
}: {
  title: string
  intro: string
  updated: string
  sections: PolicySection[]
}) {
  return (
    <div style={{ background: "#f8faff", minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(135deg,#1e3a8a,#0d1f4e)", padding: "28px 0 30px" }}>
        <div className="wrap">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />
          <h1 style={{ fontFamily: "Playfair Display,serif", fontSize: "clamp(24px,3vw,34px)", fontWeight: 900, color: "#fff", marginBottom: 8 }}>{title}</h1>
          <p style={{ color: "rgba(255,255,255,.8)", fontSize: 13.5 }}>Last updated: {updated}</p>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 28, paddingBottom: 48, maxWidth: 880 }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "28px 30px" }}>
          <p style={{ color: "#374151", fontSize: 15, lineHeight: 1.85, marginBottom: 8 }}>{intro}</p>
          {sections.map((s, i) => (
            <section key={i} style={{ marginTop: 24 }}>
              <h2 style={{ fontFamily: "Playfair Display,serif", fontWeight: 900, color: "#0d1f4e", fontSize: 19, marginBottom: 10 }}>{s.heading}</h2>
              {s.paragraphs?.map((p, j) => (
                <p key={j} style={{ color: "#374151", fontSize: 14.5, lineHeight: 1.8, marginBottom: 10 }}>{p}</p>
              ))}
              {s.bullets && (
                <ul style={{ margin: 0, paddingLeft: 20, color: "#374151", fontSize: 14.5, lineHeight: 1.9 }}>
                  {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              )}
            </section>
          ))}

          <section style={{ marginTop: 26, borderTop: "1px solid #e2e8f0", paddingTop: 18 }}>
            <h2 style={{ fontFamily: "Playfair Display,serif", fontWeight: 900, color: "#0d1f4e", fontSize: 18, marginBottom: 8 }}>Contact Us</h2>
            <p style={{ color: "#374151", fontSize: 14.5, lineHeight: 1.8, margin: 0 }}>
              Questions about this policy? Email <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#1847d4", fontWeight: 700 }}>{SUPPORT_EMAIL}</a> or call <a href={`tel:${SUPPORT_PHONE}`} style={{ color: "#1847d4", fontWeight: 700 }}>{SUPPORT_PHONE}</a>. Noble Job is an initiative of NCC Foundation.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
