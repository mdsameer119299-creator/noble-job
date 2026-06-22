import type { StateIntro } from "@/lib/data/govtStateContent"

const para = { color: "#374151", fontSize: 14.8, lineHeight: 1.85, margin: "0 0 12px" } as const

/**
 * On-page editorial block for a state govt-jobs page: unique intro paragraphs,
 * recruiter chips and an FAQ accordion. Pairs with the FAQPage JSON-LD emitted
 * by the page so the same Q&A is both crawlable structured data and visible UX.
 */
export function GovtStateContent({ intro, heading }: { intro: StateIntro; heading: string }) {
  return (
    <section style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "22px 24px", marginBottom: 18 }}>
      <h2 style={{ fontFamily: "Playfair Display,serif", fontWeight: 900, color: "#0d1f4e", fontSize: 20, marginBottom: 14 }}>
        {heading}
      </h2>
      {intro.paragraphs.map((p, i) => <p key={i} style={para}>{p}</p>)}

      {intro.chips.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0 4px" }}>
          {intro.chips.map((c, i) => (
            <span key={i} style={{ background: "#eff6ff", color: "#1847d4", border: "1px solid #bfdbfe", padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
              {c}
            </span>
          ))}
        </div>
      )}

      <h3 style={{ fontFamily: "Playfair Display,serif", fontWeight: 800, color: "#0d1f4e", fontSize: 17, margin: "20px 0 10px" }}>
        Frequently Asked Questions
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {intro.faqs.map((f, i) => (
          <details key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", background: "#f8faff" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, color: "#0d1f4e", fontSize: 14.2 }}>
              {f.question}
            </summary>
            <p style={{ ...para, margin: "8px 0 0" }}>{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
