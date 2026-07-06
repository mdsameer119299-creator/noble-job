/**
 * Focused assertions for the AI Resume Score pipeline (deterministic layer).
 * Run: npx tsx scripts/verify-resume-score.ts
 */
import { analyzeResume } from "../src/lib/resume/atsScore"
import { extractSkills, extractJobKeywords } from "../src/lib/resume/skills"
import { extractResumeText } from "../src/lib/resume/parse"

let failed = 0
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  PASS  ${msg}`)
  else { failed++; console.error(`  FAIL  ${msg}`) }
}

// Skill extraction --------------------------------------------------------------
const skills = extractSkills("Experienced in JavaScript, React.js, Node.js and AWS. Built REST APIs.")
ok(skills.includes("JavaScript"), "extracts JavaScript")
ok(skills.includes("React"), "extracts React from 'React.js'")
ok(skills.includes("Node.js"), "extracts Node.js")
ok(skills.includes("AWS"), "extracts AWS")
ok(skills.includes("REST"), "extracts REST")
ok(!extractSkills("JavaScript developer role").includes("Java"), "'JavaScript' does not falsely match Java (substring guard)")

// Job keyword extraction --------------------------------------------------------
const kw = extractJobKeywords("We need a Python developer with Django and PostgreSQL experience.")
ok(kw.includes("python") && kw.includes("django") && kw.includes("postgresql"), "JD keywords include python/django/postgresql")

// Full analysis (no JD) ---------------------------------------------------------
const goodResume = `John Doe
john.doe@example.com | +91 98765 43210

Summary
Senior software engineer with 6 years of experience building web apps.

Skills
JavaScript, TypeScript, React, Node.js, PostgreSQL, AWS, Docker

Work Experience
- Acme Corp (2020-2024): Led a team building REST APIs, improved performance by 40%.
- Beta Ltd (2018-2020): Built React dashboards.

Education
- B.Tech Computer Science, 2018`
const r = analyzeResume({ text: goodResume })
ok(r.overallScore > 60, `strong resume scores > 60 (got ${r.overallScore})`)
ok(r.subscores.contactInfo === 100, "detects email + phone → contact 100")
ok(r.subscores.sections >= 80, "detects most sections")
ok(r.extractedSkills.length >= 5, "extracts several skills")
ok(r.jobMatchScore === null, "no JD → jobMatchScore null")
ok(r.recommendationsSource === "heuristic", "unconfigured AI → heuristic recommendations")
ok(Array.isArray(r.recommendations) && r.recommendations.length > 0, "always returns recommendations")

// Weak resume -------------------------------------------------------------------
const weak = analyzeResume({ text: "I want a job. I am hardworking." })
ok(weak.overallScore < r.overallScore, "weak resume scores lower than strong one")
ok(weak.subscores.contactInfo === 0, "no contact info → 0")
ok(weak.suggestions.some(s => /contact|email/i.test(s)), "suggests adding contact info")

// Job-match path ----------------------------------------------------------------
const jd = "Looking for a React and TypeScript engineer with AWS and Kubernetes experience."
const m = analyzeResume({ text: goodResume, jobDescription: jd })
ok(m.jobMatchScore !== null, "with JD → jobMatchScore computed")
ok(m.matchedSkills.includes("React") && m.matchedSkills.includes("TypeScript"), "matched skills include React & TypeScript")
ok(m.missingKeywords.includes("kubernetes"), "missing keywords include kubernetes")
ok(m.suggestions.some(s => /keyword/i.test(s)), "suggests adding missing keywords")

// Parser: TXT + graceful unsupported -------------------------------------------
;(async () => {
  const txt = await extractResumeText(Buffer.from("Hello resume text with enough length to pass the threshold."), "txt")
  ok(txt.text.includes("resume text"), "TXT parser returns text")
  const bad = await extractResumeText(Buffer.from("x"), "xyz")
  ok(bad.text === "" && !!bad.warning, "unsupported type → empty text + warning (no throw)")
  const empty = await extractResumeText(Buffer.alloc(0), "pdf")
  ok(empty.text === "" && !!empty.warning, "empty buffer → warning, no throw")

  // Corrupted DOCX: valid EOCD signature but bogus offsets must NOT throw.
  const corrupt = Buffer.alloc(64)
  corrupt.write("PK\x05\x06", 40, "latin1") // fake End-Of-Central-Directory
  corrupt.writeUInt16LE(1, 40 + 10) // claims 1 entry
  corrupt.writeUInt32LE(0xffffff, 40 + 16) // central-dir offset out of range
  const corruptRes = await extractResumeText(corrupt, "docx")
  ok(corruptRes.text === "" && !!corruptRes.warning, "corrupted DOCX → graceful warning, no throw")

  const largePdf = await extractResumeText(Buffer.alloc(6 * 1024 * 1024, 0x20), "pdf")
  ok(typeof largePdf.text === "string" && !!largePdf.warning, "large non-PDF bytes → warning, no throw")

  console.log(failed === 0 ? "\nALL RESUME-SCORE ASSERTIONS PASSED" : `\n${failed} ASSERTION(S) FAILED`)
  process.exit(failed === 0 ? 0 : 1)
})()
