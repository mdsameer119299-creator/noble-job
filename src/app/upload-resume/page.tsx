import type { Metadata } from "next"
import Link from "next/link"
import { ResumeUploadWidget } from "@/components/candidate/ResumeUploadWidget"
import { Breadcrumbs } from "@/components/shared/Breadcrumbs"
import { JsonLd } from "@/components/seo/JsonLd"
import { breadcrumbSchema } from "@/lib/seo/schema"
import { buildPageMetadata } from "@/lib/seo/metadata"

export const metadata: Metadata = buildPageMetadata({
  title: "Free Resume Analyzer & Career Score — Noble Job",
  description:
    "Upload your resume for a free instant resume analysis, ATS readability score, skills check and job-matching suggestions. No signup required for the initial report.",
  path: "/upload-resume",
  keywords: [
    "free resume analyzer",
    "resume checker India",
    "ATS resume checker",
    "resume score",
    "resume analysis",
    "resume review",
    "job matching resume",
    "free resume check",
  ],
})

export default function UploadResumePage() {
  const crumbs = [{ label: "Home", href: "/" }, { label: "Free Resume Analyzer" }]

  return (
    <div style={{ background: "#f8faff", minHeight: "100vh" }}>
      <JsonLd data={breadcrumbSchema(crumbs.map(c => ({ name: c.label, path: c.href })))} />

      <section style={{ background: "linear-gradient(135deg,#0d1f4e,#1847d4)", padding: "34px 0 40px" }}>
        <div className="wrap">
          <Breadcrumbs items={crumbs} />
          <div style={{ maxWidth: 820 }}>
            <h1 style={{ fontFamily: "Playfair Display,serif", fontSize: "clamp(28px,4vw,44px)", fontWeight: 900, color: "#fff", margin: "18px 0 10px", lineHeight: 1.12 }}>
              Free Resume Analyzer &amp; Career Score
            </h1>
            <p style={{ color: "rgba(255,255,255,.9)", fontSize: 16, lineHeight: 1.65, margin: 0 }}>
              Upload your resume and get an instant check of your career score, ATS readability, detected skills and practical improvement suggestions — then discover jobs that match your skills.
            </p>
          </div>
        </div>
      </section>

      <main className="wrap" style={{ paddingTop: 30, paddingBottom: 54 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,460px) minmax(0,1fr)", gap: 28, alignItems: "start" }}>
          <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 20, boxShadow: "0 8px 30px rgba(13,31,78,.06)" }}>
            <h2 style={{ fontFamily: "Playfair Display,serif", color: "#0d1f4e", fontSize: 22, fontWeight: 900, margin: "0 0 6px" }}>
              Check your resume
            </h2>
            <p style={{ color: "#64748b", fontSize: 13.5, lineHeight: 1.55, margin: "0 0 16px" }}>
              PDF, DOC or DOCX up to 5 MB. The initial report is available without creating an account.
            </p>
            <ResumeUploadWidget source="resume-page" />
          </section>

          <section style={{ color: "#334155" }}>
            <h2 style={{ fontFamily: "Playfair Display,serif", color: "#0d1f4e", fontSize: 24, fontWeight: 900, margin: "0 0 10px" }}>
              What you get from the resume check
            </h2>
            <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
              {[
                ["📊", "Career score", "A quick overall view of how your resume reads."],
                ["🔎", "ATS readability", "Identify common readability and formatting issues."],
                ["🧠", "Skills detected", "See the skills extracted from your current resume."],
                ["🎯", "Matching jobs", "Jump from your strongest detected skill to relevant Noble Job listings."],
                ["✍️", "Improvement suggestions", "Get practical suggestions before you apply."],
              ].map(([icon, title, text]) => (
                <div key={title} style={{ display: "flex", gap: 12, padding: "12px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
                  <span aria-hidden style={{ fontSize: 20 }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14 }}>{title}</div>
                    <div style={{ color: "#64748b", fontSize: 12.8, lineHeight: 1.5 }}>{text}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
              <h2 style={{ fontFamily: "Playfair Display,serif", color: "#0d1f4e", fontSize: 20, fontWeight: 900, margin: "0 0 8px" }}>
                Turn your resume into a job-search profile
              </h2>
              <p style={{ color: "#64748b", fontSize: 13.5, lineHeight: 1.65, margin: "0 0 12px" }}>
                After you review the free report, create a candidate account to save your resume and profile, receive relevant job alerts and use Noble Job's candidate features.
              </p>
              <Link href="/auth?role=candidate&tab=register" style={{ display: "inline-flex", background: "#1847d4", color: "#fff", textDecoration: "none", borderRadius: 9, padding: "10px 16px", fontWeight: 800, fontSize: 13.5 }}>
                Create Free Candidate Account →
              </Link>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
              {[
                ["Private Jobs", "/jobs/private"],
                ["Work From Home Jobs", "/jobs/wfh"],
                ["Government Jobs", "/jobs/govt"],
                ["Abroad Jobs", "/jobs/abroad"],
                ["Resume Guide for Freshers", "/guides/resume-format-for-freshers"],
              ].map(([label, href]) => (
                <Link key={href} href={href} style={{ color: "#1847d4", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "7px 12px", fontWeight: 700, fontSize: 12.5, textDecoration: "none" }}>
                  {label}
                </Link>
              ))}
            </div>
          </section>
        </div>

        <section style={{ maxWidth: 900, margin: "34px auto 0", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px" }}>
          <h2 style={{ fontFamily: "Playfair Display,serif", color: "#0d1f4e", fontSize: 21, fontWeight: 900, margin: "0 0 8px" }}>
            Resume tips before applying
          </h2>
          <p style={{ color: "#64748b", fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>
            Keep your resume focused on the role you want, use clear section headings, highlight measurable achievements and include the skills that genuinely match the job description. For more detailed examples, read our{" "}
            <Link href="/guides/resume-format-for-freshers" style={{ color: "#1847d4", fontWeight: 700 }}>resume format guide for freshers</Link>.
          </p>
        </section>
      </main>
    </div>
  )
}
