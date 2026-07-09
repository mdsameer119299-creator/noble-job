import Link from "next/link"
import { getJobs } from "@/lib/services/jobService"
import { WFH_INVENTORY, ABROAD_INVENTORY } from "@/lib/data/jobInventory"
import { jobDetailHref } from "@/lib/jobs/provenance"

/**
 * Server-rendered, crawlable job directory with URL-based pagination.
 *
 * The interactive listing (LiveJobsList / WfhJobsPanel / AbroadJobsPanel) is a
 * client component whose pagination is button-driven (onClick), so Googlebot
 * cannot follow it to page 2+. This component renders plain <a> links plus real
 * <a href="?page=N"> pagination, giving crawlers a complete path to discover
 * every GENUINE job detail URL.
 *
 * It lists ONLY genuine jobs (jobDetailHref !== null): synthetic/demo inventory
 * has noindex detail pages, so exposing it here would just feed crawlers dead
 * URLs. When there is no genuine inventory the section renders nothing — the
 * page's interactive human-facing list is unaffected, so the page is not empty.
 */

type Board = "private" | "wfh" | "abroad"
const PER_PAGE = 24

interface Row {
  href: string
  title: string
  company: string
  meta: string
}

async function loadPage(board: Board, page: number): Promise<{ rows: Row[]; totalPages: number }> {
  if (board === "private") {
    const r = await getJobs({ limit: PER_PAGE, page, sort: "latest" })
    const rows = r.jobs
      .map(j => ({
        href: jobDetailHref("private", j),
        title: j.title,
        company: j.company,
        meta: [j.location, j.salary].filter(Boolean).join(" · "),
      }))
      .filter((row): row is Row => row.href !== null)
    return { rows, totalPages: Math.max(1, Math.ceil((r.total || rows.length) / PER_PAGE)) }
  }
  if (board === "wfh") {
    // Only genuine WFH jobs get a crawlable directory link; synthetic inventory
    // (noindex detail pages) is excluded, so this is empty until real WFH
    // inventory exists.
    const all = WFH_INVENTORY
      .map(j => ({ href: jobDetailHref("wfh", j), title: j.title, company: j.company, meta: [j.cat, j.salary].filter(Boolean).join(" · ") }))
      .filter((row): row is Row => row.href !== null)
    const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE))
    return { rows: all.slice((page - 1) * PER_PAGE, page * PER_PAGE), totalPages }
  }
  const all = ABROAD_INVENTORY
    .map(j => ({ href: jobDetailHref("abroad", j), title: j.title, company: j.company, meta: [j.country, j.salary].filter(Boolean).join(" · ") }))
    .filter((row): row is Row => row.href !== null)
  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE))
  return { rows: all.slice((page - 1) * PER_PAGE, page * PER_PAGE), totalPages }
}

function pageHref(basePath: string, n: number): string {
  return n <= 1 ? basePath : `${basePath}?page=${n}`
}

function windowAround(current: number, total: number): number[] {
  const span = 2
  const start = Math.max(1, current - span)
  const end = Math.min(total, current + span)
  const out: number[] = []
  for (let i = start; i <= end; i++) out.push(i)
  return out
}

const linkBox = {
  display: "block",
  textDecoration: "none",
  background: "#f8faff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "11px 14px",
} as const

const pageLink = {
  minWidth: 36,
  textAlign: "center" as const,
  padding: "7px 11px",
  borderRadius: 8,
  border: "1.5px solid #e2e8f0",
  background: "#fff",
  color: "#1847d4",
  fontWeight: 700,
  fontSize: 13,
  textDecoration: "none",
}

export async function JobsBrowseIndex({
  board,
  page,
  basePath,
  title,
}: {
  board: Board
  page: number
  basePath: string
  title: string
}) {
  const safePage = Math.max(1, page)
  const { rows, totalPages } = await loadPage(board, safePage)
  if (!rows.length) return null
  const nums = windowAround(safePage, totalPages)

  return (
    <section
      id="browse-all"
      style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "22px 24px", margin: "8px 0 32px", scrollMarginTop: 80 }}
    >
      <h2 style={{ fontFamily: "Playfair Display,serif", fontWeight: 900, color: "#0d1f4e", fontSize: 19, marginBottom: 4 }}>
        {title}
      </h2>
      <p style={{ color: "#6b7280", fontSize: 13.5, marginBottom: 16 }}>
        Page {safePage} of {totalPages} — browse every opening. Each link opens the full job description.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 10 }}>
        {rows.map((r, i) => (
          <Link key={`${r.href}-${i}`} href={r.href} style={linkBox}>
            <span style={{ display: "block", fontWeight: 700, color: "#0d1f4e", fontSize: 13.5, lineHeight: 1.35 }}>{r.title}</span>
            <span style={{ display: "block", color: "#6b7280", fontSize: 12, marginTop: 2 }}>{r.company}{r.meta ? ` · ${r.meta}` : ""}</span>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <nav aria-label="Job listing pagination" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", justifyContent: "center", marginTop: 20 }}>
          {safePage > 1 && (
            <Link rel="prev" href={pageHref(basePath, safePage - 1)} style={{ ...pageLink, fontWeight: 800 }}>← Prev</Link>
          )}
          {nums[0] > 1 && (
            <>
              <Link href={pageHref(basePath, 1)} style={pageLink}>1</Link>
              {nums[0] > 2 && <span style={{ color: "#9ca3af", padding: "0 4px" }}>…</span>}
            </>
          )}
          {nums.map(n =>
            n === safePage ? (
              <span key={n} aria-current="page" style={{ ...pageLink, background: "#1847d4", color: "#fff", border: "1.5px solid #1847d4" }}>{n}</span>
            ) : (
              <Link key={n} href={pageHref(basePath, n)} style={pageLink}>{n}</Link>
            ),
          )}
          {nums[nums.length - 1] < totalPages && (
            <>
              {nums[nums.length - 1] < totalPages - 1 && <span style={{ color: "#9ca3af", padding: "0 4px" }}>…</span>}
              <Link href={pageHref(basePath, totalPages)} style={pageLink}>{totalPages}</Link>
            </>
          )}
          {safePage < totalPages && (
            <Link rel="next" href={pageHref(basePath, safePage + 1)} style={{ ...pageLink, fontWeight: 800 }}>Next →</Link>
          )}
        </nav>
      )}
    </section>
  )
}
