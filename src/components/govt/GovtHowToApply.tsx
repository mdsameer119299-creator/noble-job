import type { GovtJob } from "@/types/govtJob"
import { buildGovtJobLinkButtons, isPostApplicationTab } from "@/lib/services/govtOfficialLinks"
import { getGovtHowToApplySteps } from "@/lib/services/govtArticle"
import { GovtApplyLinkButton } from "./GovtApplyLinkButton"

/**
 * Section heading per tab — never "How to Apply Online" for a decided/closed
 * stage (result / admit card / answer key), where there is nothing left to
 * apply for on this record.
 */
function sectionHeading(tab: GovtJob["tab"]): string {
  if (tab === "results") return "Result"
  if (tab === "admit") return "Admit Card"
  if (tab === "answer") return "Answer Key"
  return "How to Apply Online"
}

/** Renders step-by-step instructions with a prominent, tab-appropriate CTA. */
export function GovtHowToApply({ job }: { job: GovtJob }) {
  const steps = getGovtHowToApplySteps(job)
  const links = buildGovtJobLinkButtons(job)
  const applyLink = links.find(l => l.primary) || links.find(l => l.l === "Apply Online")
  // Only the genuine "Apply Online" primary link opens the save-resume
  // interceptor; Check Result / Admit Card / Answer Key navigate straight
  // through — see GovtApplyLinkButton's own doc comment.
  const intercept = !isPostApplicationTab(job.tab) && applyLink?.l === "Apply Online"

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
        <span>📝</span> {sectionHeading(job.tab)}
      </h2>

      {applyLink && (
        <GovtApplyLinkButton
          href={applyLink.href}
          jobTitle={job.title}
          intercept={intercept}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#1847d4",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 10,
            border: "none",
            fontWeight: 800,
            fontSize: 14,
            textDecoration: "none",
            marginBottom: 18,
          }}
        >
          {applyLink.l} on Official Portal →
        </GovtApplyLinkButton>
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
