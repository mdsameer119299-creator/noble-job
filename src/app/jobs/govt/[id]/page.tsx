import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { buildPageMetadata } from "@/lib/seo/metadata"
import Link from "next/link"
import {
  getGovtJobBySlug,
  getRelatedGovtJobs,
  getStateRelatedGovtJobs,
  getQualificationRelatedGovtJobs,
} from "@/lib/services/govtJobService"
import { GOVT_JOBS } from "@/lib/data/govtData"
import { getStateBySlug } from "@/lib/config/govtTaxonomy"
import { Breadcrumbs } from "@/components/shared/Breadcrumbs"
import { GovtJobJsonLd } from "@/components/govt/GovtJobJsonLd"
import { RelatedGovtJobs } from "@/components/govt/RelatedGovtJobs"
import { GovtHowToApply } from "@/components/govt/GovtHowToApply"
import { buildGovtJobLinkButtons } from "@/lib/services/govtOfficialLinks"

interface Props { params: Promise<{ id: string }> }

export const dynamicParams = true
export function generateStaticParams() {
  return GOVT_JOBS.slice(0, 50).map(j => ({ id: j.slug || j.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const job = await getGovtJobBySlug(id)
  if (!job) return { title: "Government Job Not Found — Noble Job" }
  const desc = `${job.org} ${job.title}: ${job.vacancies} vacancies for ${job.post}. Qualification: ${job.qualification}. Last date: ${job.lastDate}. Check eligibility, salary, age limit, fee & apply online.`
  return buildPageMetadata({
    title: `${job.title} — ${job.vacancies} Posts`,
    description: desc.slice(0, 300),
    path: `/jobs/govt/${job.slug || job.id}`,
    keywords: [job.org, job.post, job.title, "government jobs", "sarkari naukri", job.qualification, ...(job.categoryTags || [])],
    ogType: "article",
  })
}

function Section({ id, title, icon, children }: { id: string; title: string; icon: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "22px 24px", marginBottom: 16, scrollMarginTop: 80 }}>
      <h2 style={{ fontFamily: "Playfair Display,serif", fontWeight: 900, color: "#0d1f4e", fontSize: 19, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span>{icon}</span> {title}
      </h2>
      {children}
    </section>
  )
}

export default async function GovtJobDetailPage({ params }: Props) {
  const { id } = await params
  const job = await getGovtJobBySlug(id)
  if (!job) notFound()

  const related = getRelatedGovtJobs(job)
  const stateRelated = getStateRelatedGovtJobs(job)
  const qualRelated = getQualificationRelatedGovtJobs(job)
  const stateLabel = job.stateSlug ? getStateBySlug(job.stateSlug)?.label : undefined

  const links = buildGovtJobLinkButtons(job)

  const quickFacts = [
    { l: "Organisation", v: job.org },
    { l: "Post Name", v: job.post },
    { l: "Total Vacancies", v: job.vacancies },
    { l: "Qualification", v: job.qualification },
    { l: "Age Limit", v: job.ageRange },
    { l: "Application Fee", v: job.fee && job.fee !== "0" ? `₹${job.fee.replace(/[^\d]/g, "")}` : "Nil / Exempted" },
    { l: "Salary", v: job.salary },
    { l: "Job Location", v: job.location },
    { l: "Last Date", v: job.lastDate },
  ].filter(f => f.v)

  return (
    <div style={{ background: "#f8faff", minHeight: "100vh" }}>
      <GovtJobJsonLd job={job} />

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg,${job.color || "#1e3a8a"},#0d1f4e)`, padding: "28px 0 32px" }}>
        <div className="wrap">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Govt Jobs", href: "/jobs/govt" },
              ...(job.stateSlug ? [{ label: stateLabel || "State", href: `/jobs/govt/state/${job.stateSlug}` }] : []),
              { label: job.title },
            ]}
          />
          <div style={{ display: "inline-block", background: "rgba(255,255,255,.15)", padding: "4px 12px", borderRadius: 18, fontSize: 12, color: "#e0e8ff", fontWeight: 700, marginBottom: 10 }}>{job.org}</div>
          <h1 style={{ fontFamily: "Playfair Display,serif", fontSize: "clamp(24px,3vw,34px)", fontWeight: 900, color: "#fff", marginBottom: 10, lineHeight: 1.2 }}>{job.title}</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[`👤 ${job.vacancies} Vacancies`, `📅 Last Date: ${job.lastDate}`, `🎓 ${job.qualification}`, `📍 ${job.location}`].map((t, i) => (
              <span key={i} style={{ background: "rgba(255,255,255,.15)", padding: "5px 13px", borderRadius: 16, fontSize: 12.5, color: "#fff", fontWeight: 600 }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 24, alignItems: "flex-start" }} className="max-lg:!grid-cols-1">
          {/* Main */}
          <div>
            <Section id="overview" title="Overview" icon="📋">
              <p style={{ color: "#374151", fontSize: 14.5, lineHeight: 1.75 }}>{job.overview}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 16 }}>
                {quickFacts.map((f, i) => (
                  <div key={i} style={{ background: "#f8faff", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 3 }}>{f.l}</div>
                    <div style={{ fontWeight: 700, color: "#0d1f4e", fontSize: 13.5 }}>{f.v}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="vacancy-details" title="Vacancy Details" icon="👥">
              {job.vacancyBreakup?.length ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ background: "#f0f4ff", textAlign: "left" }}>
                      <th style={{ padding: "10px 12px", color: "#0d1f4e" }}>Post Name</th>
                      <th style={{ padding: "10px 12px", color: "#0d1f4e" }}>Total Posts</th>
                      <th style={{ padding: "10px 12px", color: "#0d1f4e" }}>Eligibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.vacancyBreakup.map((v, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0d1f4e" }}>{v.post}</td>
                        <td style={{ padding: "10px 12px", color: "#374151" }}>{v.total}</td>
                        <td style={{ padding: "10px 12px", color: "#374151" }}>{v.eligibility || job.qualification}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: "#374151", fontSize: 14.5, lineHeight: 1.75 }}>
                  A total of <strong>{job.vacancies}</strong> vacancies are notified for the post of <strong>{job.post}</strong>.
                  Refer to the official notification for the category-wise (UR/OBC/SC/ST/EWS) break-up.
                </p>
              )}
            </Section>

            <Section id="eligibility" title="Eligibility" icon="🎓"><p style={{ color: "#374151", fontSize: 14.5, lineHeight: 1.75 }}>{job.eligibility}</p></Section>
            <Section id="age-limit" title="Age Limit" icon="🎂"><p style={{ color: "#374151", fontSize: 14.5, lineHeight: 1.75 }}>{job.ageLimit}</p></Section>
            <Section id="salary" title="Salary" icon="💰"><p style={{ color: "#374151", fontSize: 14.5, lineHeight: 1.75 }}>{job.salaryDetails}</p></Section>

            <Section id="selection-process" title="Selection Process" icon="✅">
              <ol style={{ margin: 0, paddingLeft: 20, color: "#374151", fontSize: 14.5, lineHeight: 1.9 }}>
                {job.selectionProcess?.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </Section>

            <Section id="application-fee" title="Application Fee" icon="💳">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <tbody>
                  {job.feeDetails?.map((f, i) => (
                    <tr key={i} style={{ borderTop: i ? "1px solid #f1f5f9" : "none" }}>
                      <td style={{ padding: "9px 12px", color: "#374151" }}>{f.category}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: "#0d1f4e" }}>{f.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section id="exam-pattern" title="Exam Pattern" icon="🧪"><p style={{ color: "#374151", fontSize: 14.5, lineHeight: 1.75 }}>{job.examPattern}</p></Section>
            <Section id="syllabus" title="Syllabus" icon="📚">
              <p style={{ color: "#374151", fontSize: 14.5, lineHeight: 1.75 }}>
                {job.syllabusContent || `The detailed syllabus for ${job.title} covers General Awareness, Reasoning Ability, Quantitative Aptitude, English/General Knowledge and post-specific technical subjects. Download the full syllabus from the official notification PDF.`}
              </p>
            </Section>

            <Section id="important-dates" title="Important Dates" icon="📅">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <tbody>
                  {job.importantDates?.map((d, i) => (
                    <tr key={i} style={{ borderTop: i ? "1px solid #f1f5f9" : "none" }}>
                      <td style={{ padding: "9px 12px", color: "#374151" }}>{d.label}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: "#0d1f4e" }}>{d.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <GovtHowToApply job={job} />

            {links.length > 0 && (
              <Section id="important-links" title="Important Links" icon="🔗">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                  {links.map((lk, i) => (
                    <a
                      key={`${lk.l}-${i}`}
                      href={lk.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: lk.primary ? "#1847d4" : "#eff6ff",
                        color: lk.primary ? "#fff" : "#1847d4",
                        border: lk.primary ? "none" : "1px solid #bfdbfe",
                        padding: "11px 16px",
                        borderRadius: 10,
                        fontWeight: 800,
                        fontSize: 13.5,
                        textDecoration: "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      {lk.l}<span>→</span>
                    </a>
                  ))}
                </div>
              </Section>
            )}

            {job.faqs?.length ? (
              <Section id="faqs" title="Frequently Asked Questions" icon="❓">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {job.faqs.map((f, i) => (
                    <div key={i}>
                      <div style={{ fontWeight: 700, color: "#0d1f4e", fontSize: 14, marginBottom: 4 }}>Q. {f.q}</div>
                      <div style={{ color: "#374151", fontSize: 13.8, lineHeight: 1.7 }}>{f.a}</div>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            <div style={{ background: "#fffbeb", borderRadius: 10, padding: "14px 16px", fontSize: 12.5, color: "#92400e", border: "1px solid #fcd34d" }}>
              ⚠️ Always verify all details from the official notification before applying. Noble Job is not responsible for changes in dates, vacancies or eligibility.
            </div>
          </div>

          {/* Sidebar */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "18px 16px", position: "sticky", top: 16 }}>
              <h3 style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14.5, marginBottom: 12 }}>Apply / Quick Links</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {links.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                    Official apply links are being updated. See the How to Apply section above.
                  </p>
                ) : (
                  links.slice(0, 4).map((lk, i) => (
                    <a
                      key={`${lk.l}-${i}`}
                      href={lk.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: lk.primary ? "#1847d4" : "#f8faff",
                        color: lk.primary ? "#fff" : "#1e3a8a",
                        border: lk.primary ? "none" : "1.5px solid #e2e8f0",
                        padding: "10px 14px",
                        borderRadius: 9,
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: "none",
                        textAlign: "center",
                      }}
                    >
                      {lk.l}
                    </a>
                  ))
                )}
              </div>
            </div>
            <RelatedGovtJobs title="Related Government Jobs" jobs={related} icon="🔗" />
            <RelatedGovtJobs title={stateLabel ? `More Jobs in ${stateLabel}` : "State-wise Jobs"} jobs={stateRelated} icon="🗺️" />
            <RelatedGovtJobs title={`Jobs for ${job.qualification?.slice(0, 24) || "Your Qualification"}`} jobs={qualRelated} icon="🎓" />
            <Link href="/jobs/govt" style={{ textAlign: "center", color: "#1847d4", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>← Back to all Govt Jobs</Link>
          </aside>
        </div>
      </div>
    </div>
  )
}
