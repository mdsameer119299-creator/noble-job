import type { GovtJob } from "@/types/govtJob"
import { buildGovtJobLinkButtons } from "@/lib/services/govtOfficialLinks"
import { getGovtHowToApplySteps } from "@/lib/services/govtArticle"

/** Renders step-by-step apply instructions with a prominent CTA. */
export function GovtHowToApply({ job }: { job: GovtJob }) {
  const steps = getGovtHowToApplySteps(job)
  const applyLink =
    buildGovtJobLinkButtons(job).find(l => l.primary) ||
    buildGovtJobLinkButtons(job).find(l => l.l === "Apply Online")

  if (!steps.length && !applyLink) return null

  return (
    <section
      id="how-to-apply"
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1.5px solid #e2e8f0",
        padding: "22px 24px",
        marginBottom: 16,
        scrollMarginTop: 80,
      }}
    >
      <h2
        style={{
          fontFamily: "Playfair Display,serif",
          fontWeight: 900,
          color: "#0d1f4e",
          fontSize: 19,
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>📝</span> How to Apply Online
      </h2>

      {applyLink && (
        <a
          href={applyLink.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#1847d4",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 14,
            textDecoration: "none",
            marginBottom: 18,
          }}
        >
          Apply Online on Official Portal →
        </a>
      )}

      {steps.length > 0 && (
        <ol style={{ margin: 0, paddingLeft: 20, color: "#374151", fontSize: 14.5, lineHeight: 1.85 }}>
          {steps.map((step, i) => {
            const urlMatch = step.match(/(https?:\/\/[^\s]+)/)
            if (!urlMatch) {
              return <li key={i}>{step}</li>
            }
            const url = urlMatch[1]
            const before = step.slice(0, urlMatch.index)
            const after = step.slice(urlMatch.index! + url.length)
            return (
              <li key={i}>
                {before}
                <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#1847d4", fontWeight: 700 }}>
                  {url}
                </a>
                {after}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
