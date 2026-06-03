/**
 * types/govtJob.ts — Government job types
 *
 * Matches the GOVT_DATA structure from the original js-govt script.
 * All 5 tabs: latest, upcoming, results, admit, answer.
 * The full 10-section detail modal structure.
 */

export type GovtJobTab =
  | "latest" | "upcoming" | "admit" | "results" | "answer"
  | "syllabus" | "scholarships"
  | "railway" | "banking" | "ssc" | "upsc" | "state" | "psu"

/** All govt categories with display metadata (used by the tab bar + auto-update config). */
export const GOVT_CATEGORIES: { id: GovtJobTab; label: string; icon: string; kind: "stage" | "sector" }[] = [
  { id: "latest",       label: "Latest Jobs",      icon: "🆕", kind: "stage" },
  { id: "upcoming",     label: "Upcoming",         icon: "📅", kind: "stage" },
  { id: "admit",        label: "Admit Card",       icon: "🎫", kind: "stage" },
  { id: "results",      label: "Results",          icon: "🏆", kind: "stage" },
  { id: "answer",       label: "Answer Key",       icon: "🔑", kind: "stage" },
  { id: "syllabus",     label: "Syllabus",         icon: "📚", kind: "stage" },
  { id: "scholarships", label: "Scholarships",     icon: "🎓", kind: "stage" },
  { id: "railway",      label: "Railway",          icon: "🚆", kind: "sector" },
  { id: "banking",      label: "Banking",          icon: "🏦", kind: "sector" },
  { id: "ssc",          label: "SSC",              icon: "📝", kind: "sector" },
  { id: "upsc",         label: "UPSC",             icon: "🏛", kind: "sector" },
  { id: "state",        label: "State Government",  icon: "🗺️", kind: "sector" },
  { id: "psu",          label: "PSU Jobs",         icon: "⚙️", kind: "sector" },
]

export interface GovtImportantDate { label: string; date: string }
export interface GovtFaq { q: string; a: string }

export interface GovtJob {
  id:              string
  /** Unique SEO slug — every job has its own URL: /jobs/govt/<slug>. */
  slug?:           string
  title:           string
  org:             string
  short:           string
  post:            string
  vacancies:       string
  qualification:   string
  ageRange:        string
  fee:             string
  lastDate:        string
  startDate?:      string
  examDate?:       string
  salary:          string
  location:        string
  state?:          string
  tab:             GovtJobTab
  /** Department / recruiting body (used for filters + related). */
  department?:     string
  /** Years of experience required (used for filters). */
  experience?:     string
  /** Taxonomy tags resolved at ingestion: category slugs + qualification slugs + state slug. */
  categoryTags?:   string[]
  qualificationTags?: string[]
  stateSlug?:      string
  officialUrl?:    string
  notificationUrl?: string
  notificationPdf?: string
  resultUrl?:      string
  admitUrl?:       string
  answerUrl?:      string
  applyUrl?:       string
  color:           string
  badge?:          string
  status:          "active" | "expired"
  jobStatus?:      import("./job").JobStatus
  // ── Rich SEO detail fields ──────────────────────────────
  overview?:       string
  vacancyBreakup?: { post: string; total: string; eligibility?: string }[]
  eligibility?:    string
  ageLimit?:       string
  salaryDetails?:  string
  selectionProcess?: string[]
  feeDetails?:     { category: string; amount: string }[]
  examPattern?:    string
  syllabusContent?: string
  importantDates?: GovtImportantDate[]
  faqs?:           GovtFaq[]
  /** Step-by-step online application instructions. */
  howToApply?:     string[]
  /** Auto-generated article body (markdown-ish plain text). */
  article?:        string
  postedAt?:       string
  /** Legacy snake_case aliases (fallback SQL / seed data). */
  age_range?:      string
  last_date?:      string
  exam_date?:      string
  start_date?:     string
  notification_url?: string
  official_url?:   string
  result_url?:     string
  admit_url?:      string
  answer_url?:     string
}

/** Non-job government content (admit cards, results, answer keys, syllabus, previous papers). */
export interface GovtContentItem {
  id:        string
  slug:      string
  contentType: "admit_cards" | "results" | "answer_keys" | "syllabus" | "previous_papers"
  title:     string
  org:       string
  examName:  string
  date:      string
  link?:     string
  state?:    string
  stateSlug?: string
  color?:    string
  badge?:    string
}

// 10 sections in the GovtDetailModal
export type GovtDetailSection =
  | "overview" | "vacancies" | "eligibility" | "age"
  | "fees" | "selection" | "dates" | "links" | "faq" | "disclaimer"
