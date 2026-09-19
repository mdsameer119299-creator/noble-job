/**
 * jobPostingDescription.ts — builds the JobPosting `description` from STORED data
 * only. Pure and dependency-free (unit-testable).
 *
 * The rule (Google's JobPosting guidelines + NobleJob's "no fabrication" rule): the
 * structured-data description must represent the job information actually held in
 * the record and shown on the page. It is therefore composed of exactly two things:
 *
 *   1. the stored employer / source description text, and
 *   2. a short list of stored factual fields (employer, location, employment type,
 *      experience, skills, salary…), each included only when it holds a real value.
 *
 * It is NEVER composed from template copy. The page's generated overview, "about
 * the employer", responsibilities, benefits, selection stages and FAQs (see
 * `jobContent.ts`) are page copy for readers, not employer-provided facts, and must
 * not be presented to Google as if the employer had stated them.
 *
 * When the record does not carry enough real information for a complete
 * description, the builders return `null` and NO JobPosting is emitted.
 */

/** A stored description shorter than this is not a job description. */
export const MIN_DESCRIPTION_CHARS = 150
export const MIN_DESCRIPTION_WORDS = 20
/** Google's structured-data description field is capped; we stay well inside it. */
export const MAX_DESCRIPTION_HTML_CHARS = 5000

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", hellip: "…",
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => {
      const c = Number(n)
      return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : " "
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const c = parseInt(h, 16)
      return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : " "
    })
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m)
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/**
 * Stored text (plain or HTML) → plain text with line structure kept. Tags and
 * scripts are dropped; block-level closers / <br> become line breaks and <li>
 * becomes a "- " bullet, so the result can be re-rendered as safe HTML.
 */
export function storedTextToPlain(raw?: string | null): string {
  if (raw == null) return ""
  let t = String(raw)
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
  t = t.replace(/<li[^>]*>/gi, "\n- ")
  t = t.replace(/<\/(p|div|h[1-6]|ul|ol|li|tr|section|article)>/gi, "\n\n")
  t = t.replace(/<br\s*\/?>/gi, "\n")
  t = t.replace(/<[^>]+>/g, " ")
  t = decodeEntities(t)
  return t
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(l => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Plain, single-line text of arbitrary stored HTML/text (word counting, length checks). */
export function plainTextOf(raw?: string | null): string {
  return storedTextToPlain(raw).replace(/\s+/g, " ").trim()
}

function wordCount(plain: string): number {
  return plain ? plain.split(/\s+/).length : 0
}

/** Does this stored text carry enough content to BE a job description? */
export function isSubstantiveDescription(raw?: string | null): boolean {
  const p = plainTextOf(raw)
  return p.length >= MIN_DESCRIPTION_CHARS && wordCount(p) >= MIN_DESCRIPTION_WORDS
}

/* ------------------------------------------------------------------ */
/* Stored description → HTML                                           */
/* ------------------------------------------------------------------ */

const BULLET_RE = /^\s*(?:[-*•▪◦‣]|\d{1,2}[.)])\s+/

/** Cut `s` at the last whitespace before `max` (never mid-word / mid-entity). */
function cutAtWord(s: string, max: number): string {
  if (s.length <= max) return s
  const slice = s.slice(0, max)
  const i = slice.search(/\s\S*$/)
  return (i > max * 0.6 ? slice.slice(0, i) : slice).trimEnd() + "…"
}

/**
 * Render stored description text as SAFE HTML: every character is escaped, only
 * <p>, <ul> and <li> are produced. Returns "" for empty input. Stops adding blocks
 * once `budget` characters of HTML are used.
 */
function plainToHtml(plain: string, budget: number): string {
  const blocks = plain.split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
  let html = ""
  for (const block of blocks) {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean)
    const allBullets = lines.length > 0 && lines.every(l => BULLET_RE.test(l))
    let chunk: string
    if (allBullets) {
      chunk = `<ul>${lines.map(l => `<li>${escapeHtml(l.replace(BULLET_RE, ""))}</li>`).join("")}</ul>`
    } else {
      chunk = `<p>${lines.map(l => escapeHtml(l.replace(BULLET_RE, "• "))).join("<br>")}</p>`
    }
    if (html.length + chunk.length > budget) {
      if (!html) {
        // A single oversized block: keep its start, cut on a word boundary.
        const room = Math.max(0, budget - 8)
        html = `<p>${escapeHtml(cutAtWord(plainTextOf(block), Math.floor(room / 1.2)))}</p>`
      }
      break
    }
    html += chunk
  }
  return html
}

/* ------------------------------------------------------------------ */
/* Stored facts                                                        */
/* ------------------------------------------------------------------ */

/** Values that mean "no data" — never rendered as a fact. */
const PLACEHOLDER_RE =
  /^(?:-+|–|—|n\/?a|na|nil|none|null|undefined|tba|tbd|tbc|not (?:specified|available|applicable|disclosed|mentioned|provided)|unspecified|unknown|as per (?:norms|company norms|industry standards|rules|requirement|policy)|competitive|best in industry|negotiable|any|various|all india|india)$/i

/** True when a stored value is a real, displayable fact. */
export function isRealFactValue(v?: string | null): boolean {
  const t = plainTextOf(v)
  if (!t || t.length > 300) return false
  return !PLACEHOLDER_RE.test(t)
}

export interface StoredFact {
  label: string
  value?: string | string[] | null
}

/** `<ul><li>Label: value</li>…</ul>` from the facts that hold a real value; "" when none do. */
export function factsHtml(facts: readonly StoredFact[]): string {
  const items: string[] = []
  for (const f of facts) {
    const v = Array.isArray(f.value)
      ? f.value.map(x => plainTextOf(x)).filter(isRealFactValue).join(", ")
      : plainTextOf(f.value)
    if (!isRealFactValue(v)) continue
    items.push(`<li>${escapeHtml(f.label)}: ${escapeHtml(v)}</li>`)
  }
  return items.length ? `<ul>${items.join("")}</ul>` : ""
}

/** How many of these facts hold a real value. */
export function countRealFacts(facts: readonly StoredFact[]): number {
  return facts.filter(f =>
    Array.isArray(f.value) ? f.value.some(isRealFactValue) : isRealFactValue(f.value),
  ).length
}

/**
 * Clamp finished description HTML to `max` characters on a block boundary
 * (`</p>` / `</ul>`), so a cut can never leave an open tag or a half-list.
 * Returns "" when not even one whole block fits.
 */
export function clampDescriptionHtml(html: string, max: number = MAX_DESCRIPTION_HTML_CHARS): string {
  if (html.length <= max) return html
  const head = html.slice(0, max)
  const p = head.lastIndexOf("</p>")
  const u = head.lastIndexOf("</ul>")
  const end = Math.max(p >= 0 ? p + 4 : -1, u >= 0 ? u + 5 : -1)
  return end > 0 ? head.slice(0, end) : ""
}

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

/**
 * Private / WFH / abroad: the STORED employer description (required — it must be
 * substantive on its own) followed by the stored facts. Returns `null` when the
 * record has no substantive stored description; facts alone do not make a job
 * description, so no JobPosting is emitted for such a record.
 */
export function buildStoredDescription(input: { description?: string | null; facts?: readonly StoredFact[] }): string | null {
  if (!isSubstantiveDescription(input.description)) return null
  const facts = factsHtml(input.facts ?? [])
  const body = plainToHtml(storedTextToPlain(input.description), MAX_DESCRIPTION_HTML_CHARS - facts.length)
  if (!body) return null
  return body + facts
}

/** Fields of a government notification that are stored (not template-generated). */
export interface GovtStoredFields {
  title?: string
  org?: string
  post?: string
  /** Only when the stored value is a real number — never the synthesized display count. */
  vacanciesStated?: string
  qualification?: string
  salary?: string
  lastDate?: string
  ageRange?: string
  fee?: string
  startDate?: string
  examDate?: string
  location?: string
  state?: string
}

/** Minimum stored facts (beyond organisation + post) a government description needs. */
export const GOVT_MIN_EXTRA_FACTS = 3

/**
 * Government notification description from STORED FIELDS ONLY. Adapters supply no
 * narrative text, and the page's `overview` / eligibility / selection / FAQ copy is
 * generated from templates — it is deliberately not used here.
 *
 * Requires the organisation, the post, and at least `GOVT_MIN_EXTRA_FACTS` further
 * real facts; otherwise `null` (no JobPosting).
 */
export function buildGovtFactsDescription(g: GovtStoredFields): string | null {
  if (!isRealFactValue(g.org) || !isRealFactValue(g.post)) return null
  // "All India" is the ingestion default when no place is known, not a fact.
  const place = [g.location, g.state].find(v => isRealFactValue(v) && !/^all india$/i.test(plainTextOf(v)))
  const extra: StoredFact[] = [
    { label: "Vacancies", value: g.vacanciesStated },
    { label: "Qualification", value: g.qualification },
    { label: "Salary", value: g.salary },
    { label: "Age limit", value: g.ageRange },
    { label: "Application fee", value: g.fee },
    { label: "Application start date", value: g.startDate },
    { label: "Last date to apply", value: g.lastDate },
    { label: "Exam date", value: g.examDate },
    { label: "Location", value: place },
  ]
  if (countRealFacts(extra) < GOVT_MIN_EXTRA_FACTS) return null
  const lead = isRealFactValue(g.title) ? `<p>${escapeHtml(plainTextOf(g.title))}</p>` : ""
  const html =
    lead +
    factsHtml([
      { label: "Recruiting organisation", value: g.org },
      { label: "Post", value: g.post },
      ...extra,
    ])
  return plainTextOf(html).length >= MIN_DESCRIPTION_CHARS / 2 ? html : null
}
