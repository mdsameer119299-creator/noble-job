/**
 * resume/skills.ts — deterministic skill & keyword extraction.
 *
 * A curated dictionary maps canonical skill names to the surface forms that
 * appear in resumes/JDs. Matching is whole-word and case-insensitive. This is
 * real extraction (no AI, no fabrication) and is fully unit-testable.
 */

/** canonical → alias surface forms (lowercased). Canonical is always included. */
const SKILL_DICTIONARY: Record<string, string[]> = {
  JavaScript: ["javascript", "js", "es6"],
  TypeScript: ["typescript", "ts"],
  Python: ["python"],
  Java: ["java"],
  "C++": ["c++", "cpp"],
  "C#": ["c#", "c sharp", "csharp"],
  Go: ["golang", "go lang"],
  Ruby: ["ruby"],
  PHP: ["php"],
  Swift: ["swift"],
  Kotlin: ["kotlin"],
  SQL: ["sql"],
  React: ["react", "react.js", "reactjs"],
  "Next.js": ["next.js", "nextjs"],
  "Node.js": ["node.js", "nodejs", "node js"],
  Angular: ["angular", "angularjs"],
  "Vue.js": ["vue", "vue.js", "vuejs"],
  Express: ["express", "express.js"],
  Django: ["django"],
  Flask: ["flask"],
  Spring: ["spring", "spring boot"],
  HTML: ["html", "html5"],
  CSS: ["css", "css3"],
  Tailwind: ["tailwind", "tailwindcss"],
  PostgreSQL: ["postgresql", "postgres"],
  MySQL: ["mysql"],
  MongoDB: ["mongodb", "mongo"],
  Redis: ["redis"],
  GraphQL: ["graphql"],
  REST: ["rest", "restful", "rest api"],
  AWS: ["aws", "amazon web services"],
  Azure: ["azure"],
  GCP: ["gcp", "google cloud"],
  Docker: ["docker"],
  Kubernetes: ["kubernetes", "k8s"],
  Terraform: ["terraform"],
  "CI/CD": ["ci/cd", "cicd", "continuous integration"],
  Git: ["git", "github", "gitlab"],
  Linux: ["linux", "unix"],
  Jenkins: ["jenkins"],
  "Machine Learning": ["machine learning", "ml"],
  "Deep Learning": ["deep learning"],
  "Data Analysis": ["data analysis", "data analytics"],
  Pandas: ["pandas"],
  NumPy: ["numpy"],
  TensorFlow: ["tensorflow"],
  PyTorch: ["pytorch"],
  Excel: ["excel", "ms excel", "microsoft excel"],
  "Power BI": ["power bi", "powerbi"],
  Tableau: ["tableau"],
  Figma: ["figma"],
  "UI/UX": ["ui/ux", "ux", "ui design", "user experience"],
  Agile: ["agile", "scrum", "kanban"],
  "Project Management": ["project management", "pmp"],
  "Digital Marketing": ["digital marketing", "seo", "sem"],
  Sales: ["sales", "business development"],
  Accounting: ["accounting", "tally", "bookkeeping"],
  Communication: ["communication", "communication skills"],
  Leadership: ["leadership", "team lead", "team management"],
  "Customer Service": ["customer service", "customer support"],
}

const ESCAPE = /[.*+?^${}()|[\]\\]/g

/** Precompiled matchers: canonical → RegExp that matches any alias as a word. */
const MATCHERS: { canonical: string; re: RegExp }[] = Object.entries(SKILL_DICTIONARY).map(
  ([canonical, aliases]) => {
    const forms = [...new Set([canonical.toLowerCase(), ...aliases])]
      .sort((a, b) => b.length - a.length)
      .map((f) => f.replace(ESCAPE, "\\$&"))
    // Left boundary excludes word chars, +, #, . so we don't match inside a
    // larger token (e.g. "asp.net"). Right boundary excludes word chars, + and #
    // (so "c++"/"c#" still match) but NOT ".", so a trailing sentence period
    // delimits normally (e.g. "…and AWS." matches AWS).
    return { canonical, re: new RegExp(`(?<![\\w+#.])(?:${forms.join("|")})(?![\\w+#])`, "i") }
  }
)

/** All canonical skills the dictionary knows about. */
export const ALL_SKILLS: string[] = MATCHERS.map((m) => m.canonical)

/** Extract the set of canonical skills present in the given text. */
export function extractSkills(text: string): string[] {
  if (!text) return []
  const found: string[] = []
  for (const { canonical, re } of MATCHERS) {
    if (re.test(text)) found.push(canonical)
  }
  return found
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "our", "are", "will", "have", "has", "this", "that",
  "a", "an", "to", "of", "in", "on", "at", "as", "is", "be", "or", "we", "us", "by", "it", "from",
  "job", "work", "role", "team", "years", "year", "experience", "skills", "ability", "strong",
  "good", "excellent", "must", "should", "including", "etc", "who", "can", "all", "new", "per",
])

/** Lowercase alphanumeric tokens (length ≥ 3), stopwords removed. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9+#.]{1,}/g) || []).filter(
    (t) => t.length >= 3 && !STOPWORDS.has(t)
  )
}

/**
 * Keywords a job description emphasises: recognised skills (highest signal) plus
 * frequent domain tokens. Returned lowercased for set comparison.
 */
export function extractJobKeywords(jobDescription: string, limit = 25): string[] {
  const skills = extractSkills(jobDescription).map((s) => s.toLowerCase())
  const freq = new Map<string, number>()
  for (const t of tokenize(jobDescription)) freq.set(t, (freq.get(t) || 0) + 1)
  const topTokens = [...freq.entries()]
    .filter(([t]) => t.length >= 4)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
  return [...new Set([...skills, ...topTokens])].slice(0, limit)
}
