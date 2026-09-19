/**
 * salary.ts — parse the free-text salary strings used across the job boards
 * into a structured value Google Jobs accepts for `baseSalary`.
 *
 * Handles the real formats present in our data, e.g.
 *   "₹8-14 LPA"  "₹3.5-7 LPA"  "15,000/mo"  "56,100-1,77,500/mo"
 *   "$2,800-3,500/mo"  "£32,000-45,000/yr"  "AED 15,000-25,000/mo"
 * Returns null for non-numeric values like "Competitive", "TBA", "As per norms".
 */

export type SalaryUnit = "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR"

export interface ParsedSalary {
  currency: string
  minValue: number
  maxValue: number
  unitText: SalaryUnit
}

const CURRENCY_PATTERNS: { test: RegExp; code: string }[] = [
  { test: /(₹|\brs\.?\b|\binr\b|lpa|lakh)/i, code: "INR" },
  { test: /(aed|dirham)/i, code: "AED" },
  { test: /(sar|riyal)/i, code: "SAR" },
  { test: /(qar)/i, code: "QAR" },
  { test: /(£|\bgbp\b)/i, code: "GBP" },
  { test: /(€|\beur\b)/i, code: "EUR" },
  { test: /(\$|\busd\b)/i, code: "USD" },
]

/**
 * Word-bounded currency markers — used only in EXPLICIT mode, where a substring hit
 * ("sar" inside another word) must not count as a stated currency.
 */
const EXPLICIT_CURRENCY_PATTERNS: { test: RegExp; code: string }[] = [
  { test: /(₹|\brs\.?(?=\s|\d|$)|\binr\b|\blpa\b|\blakhs?\b)/i, code: "INR" },
  { test: /(\baed\b|\bdirhams?\b)/i, code: "AED" },
  { test: /(\bsar\b|\briyals?\b)/i, code: "SAR" },
  { test: /\bqar\b/i, code: "QAR" },
  { test: /(£|\bgbp\b)/i, code: "GBP" },
  { test: /(€|\beur\b)/i, code: "EUR" },
  { test: /(\$|\busd\b)/i, code: "USD" },
]

function detectCurrency(s: string): string {
  for (const c of CURRENCY_PATTERNS) if (c.test.test(s)) return c.code
  return "INR"
}

/** The currency the text STATES, or null when it states none. */
function statedCurrency(s: string): string | null {
  for (const c of EXPLICIT_CURRENCY_PATTERNS) if (c.test.test(s)) return c.code
  return null
}

/** The pay period the text STATES, or null when it states none. */
function statedUnit(s: string): SalaryUnit | null {
  const l = s.toLowerCase()
  if (/(\/\s*hr\b|\/\s*hour|per hour|hourly)/.test(l)) return "HOUR"
  if (/(\/\s*day|per day|daily)/.test(l)) return "DAY"
  if (/(\/\s*week|per week|weekly)/.test(l)) return "WEEK"
  if (/(\/\s*mo\b|\/\s*month|per month|monthly|\bp\.?m\.?(?=\s|$))/.test(l)) return "MONTH"
  if (/(\blpa\b|\blakhs?\b|per annum|\bp\.?a\.?(?=\s|$)|\/\s*yr|\/\s*year|per year|annual|yearly|\/\s*annum)/.test(l)) return "YEAR"
  return null
}

function detectUnit(s: string): SalaryUnit {
  const l = s.toLowerCase()
  if (/(\/\s*hr|\/\s*hour|per hour|hourly)/.test(l)) return "HOUR"
  if (/(\/\s*day|per day|daily)/.test(l)) return "DAY"
  if (/(\/\s*week|per week|weekly)/.test(l)) return "WEEK"
  if (/(\/\s*mo|\/\s*month|per month|monthly|p\.?m\.?)/.test(l)) return "MONTH"
  // Historical (display) default: LPA, "per annum", "/yr" — and an unstated period —
  // read as a yearly figure. Structured data does NOT use this guess (see requireExplicit).
  return "YEAR"
}

/**
 * Parse a salary string. Returns null when there is no usable number so the
 * caller can omit `baseSalary` entirely (an invalid baseSalary is worse than
 * none for Google Rich Results).
 */
export function parseSalary(raw?: string | null, opts?: { requireExplicit?: boolean }): ParsedSalary | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s || /^(-|n\/?a|tba|nil|competitive|as per|negotiable|best in)/i.test(s)) return null

  // EXPLICIT mode (structured data): the currency AND the pay period must both be
  // STATED in the text. "15,000" states neither a currency nor a period, and "₹15,000"
  // states no period; guessing "per year in INR" would put a wrong baseSalary in front
  // of Google, so no baseSalary is emitted instead. Only an explicit lakh marker scales.
  if (opts?.requireExplicit) {
    const currency = statedCurrency(s)
    const unitText = statedUnit(s)
    if (!currency || !unitText) return null
    const nums = (s.match(/\d[\d,]*\.?\d*/g) ?? [])
      .map(t => parseFloat(t.replace(/,/g, "")))
      .filter(n => Number.isFinite(n) && n > 0)
      .map(n => (/\b(lpa|lakhs?)\b/i.test(s) ? Math.round(n * 100000) : n))
    if (nums.length === 0) return null
    return { currency, minValue: Math.min(...nums), maxValue: Math.max(...nums), unitText }
  }

  const isLpa = /lpa|lakh|per annum|p\.?a\.?/i.test(s)
  const currency = detectCurrency(s)
  const unitText: SalaryUnit = isLpa ? "YEAR" : detectUnit(s)

  // Pull the numeric tokens (keep decimals; commas are thousands separators).
  const tokens = s.match(/\d[\d,]*\.?\d*/g)
  if (!tokens || tokens.length === 0) return null

  let nums = tokens
    .map(t => parseFloat(t.replace(/,/g, "")))
    .filter(n => Number.isFinite(n) && n > 0)
  if (nums.length === 0) return null

  // "8-14 LPA" → lakhs per annum → ₹800000–₹1400000.
  if (isLpa) nums = nums.map(n => Math.round(n * 100000))

  const minValue = Math.min(...nums)
  const maxValue = Math.max(...nums)
  return { currency, minValue, maxValue, unitText }
}

/** Human label used in body copy, e.g. "₹8,00,000 – ₹14,00,000 per year". */
export function describeSalary(p: ParsedSalary): string {
  const sym: Record<string, string> = { INR: "₹", USD: "$", GBP: "£", EUR: "€", AED: "AED ", SAR: "SAR ", QAR: "QAR " }
  const unitWord: Record<SalaryUnit, string> = { HOUR: "per hour", DAY: "per day", WEEK: "per week", MONTH: "per month", YEAR: "per year" }
  const fmt = (n: number) =>
    p.currency === "INR" ? n.toLocaleString("en-IN") : n.toLocaleString("en-US")
  const prefix = sym[p.currency] ?? `${p.currency} `
  const range =
    p.minValue === p.maxValue ? `${prefix}${fmt(p.minValue)}` : `${prefix}${fmt(p.minValue)} – ${prefix}${fmt(p.maxValue)}`
  return `${range} ${unitWord[p.unitText]}`
}
