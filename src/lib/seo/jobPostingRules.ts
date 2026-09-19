/**
 * jobPostingRules.ts — pure, dependency-free helpers that decide which
 * JobPosting fields we may truthfully emit.
 *
 * The guiding rule (Google's JobPosting guidelines + NobleJob's non-negotiables)
 * is: a field is emitted ONLY when the stored record supports it. We never
 * substitute "now", "+30 days", a default employment type, a default country
 * or a NobleJob asset for a value the record does not carry.
 */

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
}

function utcIso(y: number, m: number, d: number): string | undefined {
  if (y < 2000 || y > 2100 || m < 0 || m > 11 || d < 1 || d > 31) return undefined
  const dt = new Date(Date.UTC(y, m, d))
  // Reject roll-over such as 31 Feb.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return undefined
  return dt.toISOString()
}

/**
 * Parse a REAL calendar date from a stored value. Deliberately strict — V8's
 * `new Date()` happily turns junk such as "Job 1" or "2 days ago" into a date.
 * Accepted: ISO-8601 (`2026-01-15`, `2026-01-15T10:00:00Z`), `30 Jun 2026`,
 * `30 June 2026` and `Jun 30, 2026`. Anything else → `undefined`.
 */
export function parseRealDate(input?: string | null): string | undefined {
  if (input == null) return undefined
  const s = String(input).trim()
  if (!s || s === "-" || /^tba$/i.test(s)) return undefined

  if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) {
    const d = new Date(s.includes("T") || s.length === 10 ? s : s.replace(" ", "T"))
    if (Number.isNaN(d.getTime())) return undefined
    const y = d.getUTCFullYear()
    return y >= 2000 && y <= 2100 ? d.toISOString() : undefined
  }

  let m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4})$/)
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()]
    return mon === undefined ? undefined : utcIso(+m[3], mon, +m[1])
  }
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()]
    return mon === undefined ? undefined : utcIso(+m[3], mon, +m[2])
  }
  return undefined
}

/**
 * A "last date to apply" of `30 Jun 2026` means applications are open THROUGH that
 * day (India). Convert a parsed date to 23:59:59 IST (18:29:59 UTC) of the same
 * calendar day so `validThrough` never expires a day early.
 */
export function endOfDayIst(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 18, 29, 59)).toISOString()
}

/** True when an ISO instant is strictly in the past relative to `now`. */
export function isPast(iso: string, now: Date = new Date()): boolean {
  return new Date(iso).getTime() < now.getTime()
}

/* ------------------------------------------------------------------ */
/* Employment type                                                     */
/* ------------------------------------------------------------------ */

/** The only values Google accepts for `employmentType`. */
export type EmploymentType =
  | "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "TEMPORARY"
  | "INTERN" | "VOLUNTEER" | "PER_DIEM" | "OTHER"

/**
 * Map stored free text ("Full Time", "Full-Time Remote", "Contract", "Internship")
 * to a schema.org value. Returns `undefined` when the text does not clearly say —
 * the caller then OMITS employmentType rather than defaulting to FULL_TIME.
 * Ambiguous text that names two different types (e.g. "Full Time / Part Time")
 * is also omitted.
 */
export function normalizeEmploymentType(raw?: string | null): EmploymentType | undefined {
  const t = (raw ?? "").toString().toLowerCase()
  if (!t.trim()) return undefined
  const hits = new Set<EmploymentType>()
  if (/\bfull[\s_-]?time\b/.test(t)) hits.add("FULL_TIME")
  if (/\bpart[\s_-]?time\b/.test(t)) hits.add("PART_TIME")
  if (/\b(contract|contractor|freelance|freelancer|consultant)\b/.test(t)) hits.add("CONTRACTOR")
  if (/\b(temporary|temp|seasonal)\b/.test(t)) hits.add("TEMPORARY")
  if (/\b(intern|internship|trainee)\b/.test(t)) hits.add("INTERN")
  if (/\bvolunteer\b/.test(t)) hits.add("VOLUNTEER")
  if (/\bper[\s_-]?diem\b/.test(t)) hits.add("PER_DIEM")
  return hits.size === 1 ? [...hits][0] : undefined
}

/* ------------------------------------------------------------------ */
/* Remote                                                              */
/* ------------------------------------------------------------------ */

/**
 * Text that says the role is NOT (only) remote: hybrid, on-site, office days,
 * "remote-first", relocation, site visits… Any of these vetoes TELECOMMUTE.
 */
const NON_REMOTE_RE =
  /\b(hybrid|on[\s-]?site|onsite|in[\s-]?office|in[\s-]?person|office[\s-]?based|work[\s-]?from[\s-]?office|wfo|partial(ly)? remote|semi[\s-]?remote|remote[\s-]?first|occasional(ly)? (in[\s-]?)?office|days? (a|per|each) week (in|at) (the )?office|days? in (the )?office|(must|required to|need to|will need to) (re)?locate|relocation (is )?required|field[\s-]?work|site visits?)\b/i

/** True when any of the texts signals a hybrid / on-site / partly-remote arrangement. */
export function hasNonRemoteSignal(...texts: Array<string | null | undefined>): boolean {
  return NON_REMOTE_RE.test(texts.filter(Boolean).join(" "))
}

/**
 * True only when stored text explicitly describes a fully remote role
 * ("Full-Time Remote", "Fully Remote", "Work From Home"). Hybrid / on-site /
 * partial / "remote-first with office days" text is NOT fully remote. The board
 * a job sits on (WFH) is never evidence on its own.
 */
export function isExplicitlyFullyRemote(...texts: Array<string | null | undefined>): boolean {
  const t = texts.filter(Boolean).join(" ").toLowerCase()
  if (!t.trim()) return false
  if (NON_REMOTE_RE.test(t)) return false
  return /\b(fully[\s-]remote|100%\s*remote|remote|work[\s-]?from[\s-]?home|wfh)\b/.test(t)
}

/** Strong, unambiguous "the whole role is remote" phrasing (used on free-text descriptions). */
const STRONG_REMOTE_RE = /\b(fully[\s-]remote|100%\s*remote|completely remote|entirely remote|remote[\s-]only|work[\s-]from[\s-]home)\b/i

/**
 * Is this WFH record GENUINELY 100% remote? Requires positive evidence in the
 * stored record — the employment-type text ("Full-Time Remote") or an explicit
 * "fully / 100% remote" statement in the description — AND no hybrid / on-site /
 * office-day signal anywhere in the type, title or description. Board membership
 * is never evidence; uncertain records are NOT remote.
 */
export function isGenuinelyFullyRemote(rec: { type?: string | null; title?: string | null; description?: string | null }): boolean {
  if (hasNonRemoteSignal(rec.type, rec.title, rec.description)) return false
  return isExplicitlyFullyRemote(rec.type) || STRONG_REMOTE_RE.test(rec.description ?? "")
}

/* ------------------------------------------------------------------ */
/* Countries                                                           */
/* ------------------------------------------------------------------ */

/** Every assigned ISO 3166-1 alpha-2 code. */
const ISO_ALPHA2 = new Set(
  (
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
    "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
    "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
    "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
    "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
    "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
    "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
  ).split(" "),
)

/** Common names / aliases seen in NobleJob's abroad inventory → ISO alpha-2. */
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  india: "IN",
  uae: "AE", "u.a.e": "AE", "u.a.e.": "AE", "united arab emirates": "AE",
  "saudi arabia": "SA", ksa: "SA", saudi: "SA", "kingdom of saudi arabia": "SA",
  qatar: "QA", kuwait: "KW", oman: "OM", bahrain: "BH",
  uk: "GB", "u.k.": "GB", "united kingdom": "GB", "great britain": "GB", britain: "GB", england: "GB",
  usa: "US", "u.s.a.": "US", us: "US", "united states": "US", "united states of america": "US", america: "US",
  canada: "CA", australia: "AU", germany: "DE", france: "FR", italy: "IT", spain: "ES",
  netherlands: "NL", holland: "NL", ireland: "IE", switzerland: "CH", sweden: "SE", norway: "NO",
  denmark: "DK", finland: "FI", poland: "PL", portugal: "PT", belgium: "BE", austria: "AT",
  singapore: "SG", malaysia: "MY", japan: "JP", "south korea": "KR", korea: "KR", china: "CN",
  "hong kong": "HK", thailand: "TH", indonesia: "ID", philippines: "PH", vietnam: "VN",
  "new zealand": "NZ", nz: "NZ", "south africa": "ZA", nigeria: "NG", kenya: "KE", egypt: "EG",
  jordan: "JO", turkey: "TR", "türkiye": "TR", russia: "RU", brazil: "BR", mexico: "MX",
  maldives: "MV", "sri lanka": "LK", nepal: "NP", bangladesh: "BD", mauritius: "MU",
}

/**
 * Resolve a stored country (name, alias or 2-letter code) to an ISO 3166-1
 * alpha-2 code. Returns `undefined` when it cannot be resolved with confidence —
 * the caller then omits the location-dependent JobPosting rather than emitting a
 * raw string Google would reject.
 */
export function resolveCountryIso(country?: string | null): string | undefined {
  const raw = (country ?? "").toString().trim()
  if (!raw) return undefined
  const low = raw.toLowerCase()
  if (COUNTRY_NAME_TO_ISO[low]) return COUNTRY_NAME_TO_ISO[low]
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const up = raw.toUpperCase()
    return ISO_ALPHA2.has(up) ? up : undefined
  }
  return undefined
}

/**
 * Names that are unambiguous as a "permitted country" in free text. Deliberately
 * excludes short/ambiguous forms ("us" is a pronoun; "america", "england",
 * "holland", "korea" name only part of a country or a different one).
 */
const AMBIGUOUS_COUNTRY_WORDS = new Set(["us", "america", "england", "holland", "korea", "nz", "saudi", "britain"])
const APPLICANT_COUNTRY_NAMES = Object.keys(COUNTRY_NAME_TO_ISO)
  .filter(k => !AMBIGUOUS_COUNTRY_WORDS.has(k) && /^[a-zü .]{3,}$/.test(k))
  .sort((a, b) => b.length - a.length)
  .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
const COUNTRY_ALT = APPLICANT_COUNTRY_NAMES.join("|")
// A country followed by "-based / headquartered / company / office" describes the
// EMPLOYER ("UK-based company"), not who may apply, so it does not count.
const COUNTRY_IN_TEXT = new RegExp(
  `(?<![A-Za-z])(${COUNTRY_ALT})(?![A-Za-z])(?!\\s*[-–]?\\s*(?:based|headquartered|hq|company|companies|office|offices|startup|firm)\\b)`,
  "gi",
)

/** Phrases that introduce the country candidates must be in to apply. */
const APPLICANT_TRIGGERS: RegExp[] = [
  /\b(?:candidates|applicants|employees|professionals|talent|hires?|residents|people)\s+(?:who\s+are\s+)?(?:currently\s+)?(?:based|located|residing|living|resident)\s+(?:in|within)\s+([^.;\n|]{0,60})/gi,
  /\bmust\s+(?:currently\s+)?(?:be\s+)?(?:based|located|residing|resident|living)\s+(?:in|within)\s+([^.;\n|]{0,60})/gi,
  /\bmust\s+reside\s+(?:in|within)\s+([^.;\n|]{0,60})/gi,
  /\b(?:open|available|restricted|limited|eligible)\s+(?:only\s+)?(?:to|for)\s+(?:[a-z-]+\s+){0,3}?(?:in|from|within|residing in|based in)\s+([^.;\n|]{0,60})/gi,
  /\bonly\s+(?:for\s+)?(?:candidates|applicants|residents)\s+(?:from|in|based in|located in)\s+([^.;\n|]{0,60})/gi,
  /\bremote\s*(?:[-–—:(,]|\s(?:in|within|from|across))\s*([^.;\n|]{0,60})/gi,
  /\b(?:work[\s-]?from[\s-]?home|wfh)\s*(?:[-–—:(,]|\s(?:in|within|from|across))\s*([^.;\n|]{0,60})/gi,
]

/**
 * The single country a fully-remote role is EXPLICITLY open to, from stored text
 * such as "Remote - India", "Remote (UAE)" or "Open to candidates based in India".
 *
 * Returns `undefined` — never a guess — when the text names no country, names
 * several, or is ambiguous ("Anywhere", "Worldwide", "US timezones"). The caller
 * then omits the JobPosting rather than asserting a permitted country the record
 * does not state.
 */
export function explicitApplicantCountry(...texts: Array<string | null | undefined>): string | undefined {
  const hay = texts.filter(Boolean).join(" \n ")
  if (!hay.trim()) return undefined
  const found = new Set<string>()
  let sawWorldwide = false
  for (const re of APPLICANT_TRIGGERS) {
    re.lastIndex = 0
    for (const m of hay.matchAll(re)) {
      const clause = m[1] ?? ""
      if (/\b(anywhere|worldwide|global(ly)?|any country|across the world)\b/i.test(clause)) sawWorldwide = true
      COUNTRY_IN_TEXT.lastIndex = 0
      for (const c of clause.matchAll(COUNTRY_IN_TEXT)) {
        const iso = COUNTRY_NAME_TO_ISO[c[1].toLowerCase()]
        if (iso) found.add(iso)
      }
    }
  }
  if (sawWorldwide || found.size !== 1) return undefined
  return [...found][0]
}

/**
 * Permitted country for a fully-remote WFH role: the STORED `applicant_country`
 * field when present, else an explicit statement in the record's own text. There
 * is deliberately no default (the WFH board is India-facing, but a record that does
 * not say so is not asserted to be India-only).
 */
export function resolveApplicantCountry(
  stored: string | null | undefined,
  ...texts: Array<string | null | undefined>
): string | undefined {
  return resolveCountryIso(stored) ?? explicitApplicantCountry(...texts)
}

/** English display name for an ISO 3166-1 alpha-2 code ("IN" → "India"), or undefined. */
export function countryDisplayName(iso: string | null | undefined): string | undefined {
  const code = (iso ?? "").trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return undefined
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code)
    return name && name !== code ? name : undefined
  } catch {
    return undefined
  }
}

/* ------------------------------------------------------------------ */
/* Employer identity                                                   */
/* ------------------------------------------------------------------ */

/** A usable absolute http(s) URL, or undefined. */
export function cleanHttpUrl(url?: string | null): string | undefined {
  const u = (url ?? "").toString().trim()
  if (!/^https?:\/\//i.test(u)) return undefined
  try {
    return new URL(u).toString()
  } catch {
    return undefined
  }
}

/** Origin (scheme + host) of a URL, or undefined. */
export function originOf(url?: string | null): string | undefined {
  const c = cleanHttpUrl(url)
  if (!c) return undefined
  try {
    return new URL(c).origin
  } catch {
    return undefined
  }
}

/** True when two URLs are the same page (ignoring a trailing slash and hash). */
export function sameUrl(a?: string | null, b?: string | null): boolean {
  const x = cleanHttpUrl(a)
  const y = cleanHttpUrl(b)
  if (!x || !y) return false
  const norm = (u: string) => {
    const p = new URL(u)
    p.hash = ""
    return p.toString().replace(/\/$/, "")
  }
  return norm(x) === norm(y)
}
