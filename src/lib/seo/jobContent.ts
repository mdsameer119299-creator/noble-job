/**
 * jobContent.ts — synthesises rich, unique, indexable page copy from the
 * sparse fields we hold for private / WFH / abroad jobs.
 *
 * The goal is to lift these pages from ~150 words (which Google "discovers but
 * does not index") to 1000+ words of genuinely useful, non-duplicate content,
 * driven by the role title, company, category and skills so no two pages read
 * the same.
 */

import { parseSalary, describeSalary, type ParsedSalary } from "./salary"
import { parseRealDate } from "./jobPostingRules"

export type JobBoard = "private" | "wfh" | "abroad"

export interface JobContentInput {
  board: JobBoard
  title: string
  company: string
  category?: string
  location?: string          // city / country / "Remote"
  salary?: string
  experience?: string
  qualification?: string
  employmentType?: string     // "Full Time", "Full Time Remote", ...
  skills?: string[]
  description?: string
  /** REAL stored posting date. When absent the page shows no posted date. */
  postedAt?: string
  /**
   * The ORIGINAL employer/source publication date (`source_posted_at`) — the only date
   * JobPosting `datePosted` is built from. When present it is shown on the page too, so
   * the structured-data date is always visible; NobleJob's own listing date (`postedAt`)
   * is then labelled as such.
   */
  sourcePostedAt?: string
  /**
   * The job's identifier, shown on the page as "Job ID" — the same value JobPosting
   * `identifier` carries, so the structured-data identifier is always visible.
   */
  jobId?: string
  /**
   * The employer's REAL application deadline, if the record has one. NobleJob
   * never derives a deadline from the posting date, and its internal review date
   * must never be passed here.
   */
  applicationDeadline?: string
  /**
   * True for a generated demo / sample listing (SYNTHETIC provenance). The copy
   * then says plainly that it is an illustrative listing — it never claims the
   * named company is hiring or that an application can be submitted.
   */
  sample?: boolean
  /**
   * What "Apply" really does on this page (`applyStateFor(...).kind`, see
   * src/lib/jobs/applyRoute.ts). The How-to-Apply steps, the "Mode of Application"
   * row and the apply FAQ describe THAT — an on-site application that reaches the
   * employer, a link to the source's own site, a closed job, or an information-only
   * listing with no apply action. Omitted → the employer wording (legacy callers).
   */
  applyKind?: "employer" | "external" | "sample" | "closed" | "listing"
  remote?: boolean
}

/** "Mode of Application" row — describes what Apply actually does. */
const MODE_OF_APPLICATION: Record<NonNullable<JobContentInput["applyKind"]>, string> = {
  employer: "Online — through Noble Job (sent to the employer)",
  external: "On the original listing's own website",
  closed: "Closed — not accepting applications",
  listing: "Not applicable — information only",
  sample: "Not applicable — sample listing",
}

export interface JobContent {
  overview: string[]            // 2-3 paragraphs
  aboutOrg: string
  responsibilities: string[]
  eligibility: string[]
  skills: string[]
  salaryDetails: string
  parsedSalary: ParsedSalary | null
  benefits: string[]
  selectionProcess: string[]
  howToApply: string[]
  importantDates: { label: string; value: string }[]
  faqs: { q: string; a: string }[]
  /** ISO — the employer's real deadline only; undefined when none is stored. */
  validThrough?: string
  wordCountHint: number
}

/* ------------------------------------------------------------------ */
/* Category knowledge base — keeps copy domain-aware and non-generic.  */
/* ------------------------------------------------------------------ */

interface CategoryProfile {
  domain: string
  responsibilities: string[]
  skills: string[]
  tools: string
}

const CATEGORY_PROFILES: { match: RegExp; profile: CategoryProfile }[] = [
  {
    match: /it|software|developer|engineer(?!ing)|tech|programmer|full.?stack|backend|frontend/i,
    profile: {
      domain: "information technology and software engineering",
      responsibilities: [
        "Design, develop and maintain clean, well-tested and scalable application code",
        "Collaborate with product, design and QA teams across the full development lifecycle",
        "Write and review code, debug production issues and optimise application performance",
        "Participate in code reviews, sprint planning and daily stand-ups in an Agile team",
        "Integrate third-party APIs, databases and internal services securely",
        "Document technical decisions and contribute to engineering best practices",
      ],
      skills: ["Problem solving", "Data structures & algorithms", "Git & version control", "REST APIs", "Debugging"],
      tools: "modern frameworks, Git, CI/CD pipelines and cloud platforms",
    },
  },
  {
    match: /content|writ(er|ing)|copy|editor|blog/i,
    profile: {
      domain: "content creation and editorial strategy",
      responsibilities: [
        "Research, write and edit original, plagiarism-free content for web and marketing channels",
        "Optimise articles for SEO using target keywords, meta tags and internal linking",
        "Maintain a consistent brand voice across blogs, landing pages and social copy",
        "Proofread and fact-check content for grammar, accuracy and readability",
        "Collaborate with designers and marketers to plan an editorial calendar",
        "Track content performance and iterate based on analytics",
      ],
      skills: ["Excellent written English", "SEO writing", "Research", "Editing & proofreading", "WordPress / CMS"],
      tools: "CMS platforms, Grammarly, Google Docs and SEO tools",
    },
  },
  {
    match: /data entry|typist|back.?office/i,
    profile: {
      domain: "data management and back-office operations",
      responsibilities: [
        "Accurately enter, update and verify records in spreadsheets and internal systems",
        "Maintain data integrity by reviewing entries for errors and inconsistencies",
        "Organise, file and retrieve digital documents and records",
        "Generate basic reports and summaries from collected data",
        "Meet daily and weekly accuracy and productivity targets",
        "Maintain confidentiality of sensitive information",
      ],
      skills: ["Fast & accurate typing", "MS Excel", "Attention to detail", "Time management", "Basic computer skills"],
      tools: "MS Excel, Google Sheets and internal data-entry portals",
    },
  },
  {
    match: /sales|marketing|business development|bd|growth|digital market/i,
    profile: {
      domain: "sales, marketing and growth",
      responsibilities: [
        "Plan and execute campaigns to generate qualified leads and drive revenue",
        "Build and nurture relationships with prospects, clients and partners",
        "Track KPIs, prepare performance reports and optimise conversion funnels",
        "Manage digital channels including SEO, social media and paid ads",
        "Collaborate with content and product teams on go-to-market strategy",
        "Meet monthly sales / engagement targets",
      ],
      skills: ["Communication & negotiation", "Lead generation", "CRM tools", "Analytics", "Digital marketing"],
      tools: "CRM software, Google Analytics and marketing automation tools",
    },
  },
  {
    match: /customer|support|associate|bpo|call center|tele/i,
    profile: {
      domain: "customer experience and support",
      responsibilities: [
        "Respond to customer queries across chat, email and voice channels promptly and professionally",
        "Resolve issues, escalate complex cases and follow up to closure",
        "Maintain accurate records of interactions in the CRM",
        "Achieve customer-satisfaction, response-time and resolution targets",
        "Share recurring feedback with product and operations teams",
        "Stay updated on products, policies and processes",
      ],
      skills: ["Communication", "Active listening", "Empathy", "CRM tools", "Problem solving"],
      tools: "CRM and helpdesk software such as Zendesk or Freshdesk",
    },
  },
  {
    match: /nurse|healthcare|medical|doctor|icu|clinic|pharma/i,
    profile: {
      domain: "healthcare and patient care",
      responsibilities: [
        "Deliver safe, compassionate and high-quality patient care",
        "Monitor patients, administer treatment and maintain accurate clinical records",
        "Coordinate with doctors, specialists and the wider care team",
        "Follow clinical protocols, hygiene and safety standards",
        "Educate patients and families on care plans",
        "Maintain confidentiality and comply with medical regulations",
      ],
      skills: ["Clinical skills", "Patient care", "Attention to detail", "Communication", "Emergency response"],
      tools: "hospital management systems and clinical equipment",
    },
  },
  {
    match: /aviation|cabin crew|pilot|airline|flight/i,
    profile: {
      domain: "aviation and in-flight services",
      responsibilities: [
        "Ensure passenger safety, comfort and a premium service experience on every flight",
        "Conduct pre-flight safety checks and demonstrations",
        "Handle in-flight service, special requests and emergency procedures",
        "Maintain composure and professionalism in all situations",
        "Comply with airline and aviation-authority regulations",
        "Work effectively as part of a multicultural crew",
      ],
      skills: ["Communication", "Customer service", "Composure under pressure", "Teamwork", "Safety awareness"],
      tools: "airline service and safety procedures",
    },
  },
  {
    match: /engineer(ing)?|civil|mechanical|electrical|petroleum|construction/i,
    profile: {
      domain: "engineering and project delivery",
      responsibilities: [
        "Plan, design and review technical drawings, specifications and project deliverables",
        "Supervise execution on site and ensure compliance with safety and quality standards",
        "Coordinate with contractors, vendors and multidisciplinary teams",
        "Prepare estimates, schedules and progress reports",
        "Identify and resolve technical issues during execution",
        "Ensure projects are delivered on time and within budget",
      ],
      skills: ["Technical design", "Project management", "AutoCAD / domain tools", "Problem solving", "Site coordination"],
      tools: "industry-standard design and project-management software",
    },
  },
]

const DEFAULT_PROFILE: CategoryProfile = {
  domain: "the role's functional area",
  responsibilities: [
    "Execute day-to-day responsibilities accurately and on schedule",
    "Coordinate with team members and reporting managers to meet goals",
    "Maintain quality, compliance and documentation standards",
    "Identify opportunities to improve processes and efficiency",
    "Communicate progress, blockers and outcomes clearly",
    "Contribute positively to a collaborative work environment",
  ],
  skills: ["Communication", "Teamwork", "Time management", "Problem solving", "Attention to detail"],
  tools: "relevant industry tools and software",
}

function profileFor(input: JobContentInput): CategoryProfile {
  const hay = `${input.category || ""} ${input.title}`
  return CATEGORY_PROFILES.find(p => p.match.test(hay))?.profile ?? DEFAULT_PROFILE
}

/* ------------------------------------------------------------------ */

function isFresher(exp?: string) {
  return !exp || /fresher|0\s*-|^0|entry|trainee/i.test(exp)
}

function formatDateLabel(iso: string | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
}

function locationPhrase(input: JobContentInput): string {
  if (input.remote) return "on a fully remote / work-from-home basis from anywhere in India"
  if (!input.location) return "across India"
  return `in ${input.location}`
}

/** Build the full content object for a job. */
export function buildJobContent(input: JobContentInput): JobContent {
  const profile = profileFor(input)
  const parsedSalary = parseSalary(input.salary)
  const fresher = isFresher(input.experience)
  const cat = input.category || profile.domain
  const where = locationPhrase(input)
  const company = input.company || "the hiring organisation"
  const empType = input.employmentType || "Full Time"
  // Dates come ONLY from the stored record. No "today" / "+30 days" fallbacks.
  const postedLabel = formatDateLabel(parseRealDate(input.postedAt))
  const sourcePostedLabel = formatDateLabel(parseRealDate(input.sourcePostedAt))
  const validThrough = parseRealDate(input.applicationDeadline)
  const validLabel = formatDateLabel(validThrough)

  const overview: string[] = [
    input.sample
      ? `Sample listing: this page illustrates what a ${input.title} role ${where} in the ${cat} domain can look like. It is not a confirmed vacancy — ${company} has not asked Noble Job to advertise it and no application can be submitted for it. Browse Noble Job's current openings to find roles you can apply for.`
      : `${company} is hiring for the position of ${input.title} ${where}. This is a ${empType.toLowerCase()} opportunity in the ${cat} domain, listed on Noble Job — India's trusted job portal by NCC Foundation. ${fresher ? "Freshers and early-career candidates are encouraged to apply." : `Candidates with ${input.experience} of relevant experience are preferred.`} ${parsedSalary ? `The role offers a competitive package of ${describeSalary(parsedSalary)}.` : "Compensation is competitive and discussed during the interview."}`,
    `As a ${input.title}, you will work within ${company}'s ${profile.domain} function. ${input.description ? input.description.trim() + " " : ""}The position is well suited to professionals who are organised, dependable and keen to grow their career in ${cat}. You will use ${profile.tools} as part of your everyday work and collaborate closely with a supportive team.`,
    input.sample
      ? `This sample page shows how a full Noble Job listing is laid out — job overview, responsibilities, eligibility and skills, salary and benefits, selection process and FAQs. The details are illustrative and are not confirmed by ${company}.`
      : `This listing covers everything you need before applying — the full job overview, responsibilities, eligibility and required skills, salary and benefits, the selection process, step-by-step application instructions, and answers to the most frequently asked questions. Review the details below${validLabel ? ` and apply before the closing date of ${validLabel}` : " and confirm the application deadline with the employer before applying"}.`,
  ]

  const aboutOrg = input.sample
    ? `${company} is named here only as an example employer for this sample listing. Noble Job has not confirmed a vacancy with ${company}, and nothing on this page should be read as a hiring announcement by that company.`
    : `${company} is a recognised employer in the ${cat} space and a sought-after destination for ${input.board === "abroad" ? "international" : "Indian"} job seekers. The organisation invests in its people through structured onboarding, mentoring and clear growth paths. By hiring through Noble Job, ${company} reaches verified, job-ready candidates across India. Always confirm the latest company and role information on the official application page before submitting your application.`

  const responsibilities = profile.responsibilities

  const eligibility: string[] = [
    `Educational qualification: ${input.qualification || "as specified by the employer (graduate / diploma preferred for most roles)"}.`,
    fresher
      ? "Experience: open to freshers and candidates with up to 1 year of experience."
      : `Experience: ${input.experience} of relevant experience in ${cat}.`,
    `Strong command of the core skills listed below for the ${input.title} role.`,
    input.remote
      ? "A reliable internet connection and a quiet, distraction-free workspace for remote work."
      : `Willingness to work ${where}.`,
    "Good communication skills and the ability to work both independently and in a team.",
  ]

  const skills = Array.from(new Set([...(input.skills || []), ...profile.skills])).slice(0, 12)

  const salaryDetails = parsedSalary
    ? `The ${input.title} position at ${company} offers ${describeSalary(parsedSalary)}. The final package depends on your skills, experience and interview performance, and may include performance incentives in addition to the fixed component. Salary figures are indicative — confirm the exact CTC with the employer during the selection process.`
    : `${company} offers a competitive salary for the ${input.title} role, benchmarked to industry standards for ${cat}. The exact package is discussed during the interview and depends on your experience and skills.`

  const benefits: string[] = [
    parsedSalary ? "Competitive, market-aligned compensation" : "Competitive compensation package",
    input.remote ? "100% remote / work-from-home flexibility" : "Structured working hours with a supportive environment",
    "On-the-job training and skill development",
    "Clear career-growth and promotion opportunities",
    "Performance-based recognition and incentives",
    input.board === "abroad" ? "International exposure and global career growth" : "Exposure to industry-leading practices",
    "A collaborative, inclusive team culture",
  ]

  const selectionProcess: string[] = [
    "Online application and resume screening",
    fresher ? "Aptitude / basic skills assessment" : "Technical or domain-skills assessment",
    "Telephonic or video interview round",
    "Final interview with the hiring manager / HR",
    "Offer, document verification and onboarding",
  ]

  const applyKind = input.sample ? "sample" : (input.applyKind ?? "employer")
  const howToApply: string[] = applyKind === "sample"
    ? [
        "This is a sample listing, so there is nothing to apply for on this page.",
        "Browse Noble Job's current openings and open a listing marked as an active vacancy to apply.",
      ]
    : applyKind === "closed"
    ? [
        "This job is closed and is no longer accepting applications.",
        "Browse Noble Job's current openings to find roles you can still apply for.",
      ]
    : applyKind === "listing"
    ? [
        "This listing is for information only: it has no application link, and Noble Job does not send applications to an employer for it.",
        "Browse Noble Job's current openings and open a listing with an Apply button to apply.",
      ]
    : applyKind === "external"
    ? [
        `Read this complete job listing for the ${input.title} role to confirm you meet the eligibility criteria.`,
        "Keep an updated resume highlighting your relevant skills, experience and achievements ready.",
        "Use the apply link on this page. It opens the original listing on its own website — Noble Job does not receive or forward applications made there.",
        "Complete the application on that website, following its instructions, and attach your resume and any required documents.",
        validLabel
          ? `Submit your application before the closing date of ${validLabel}.`
          : "Submit your application as early as you can. No closing date is stated on this listing.",
      ]
    : [
    `Read this complete job listing for the ${input.title} role to confirm you meet the eligibility criteria.`,
    "Keep an updated resume highlighting your relevant skills, experience and achievements ready.",
    `Click the "Apply Now" button on this page to apply to ${company} through Noble Job.`,
    "Fill in the application form accurately and attach your resume. Your application is sent to the employer through Noble Job.",
    validLabel
      ? `Submit your application before the closing date of ${validLabel} and watch your email for next steps.`
      : "Submit your application as early as you can and watch your email for next steps. The employer has not published a closing date on this listing.",
  ]

  const importantDates = input.sample
    ? [
        { label: "Listing Type", value: "Sample listing — not an open vacancy" },
        { label: "Applications", value: "Not accepted for this listing" },
      ]
    : [
    ...(sourcePostedLabel
      ? [
          { label: "Originally Posted On", value: sourcePostedLabel },
          ...(postedLabel && postedLabel !== sourcePostedLabel ? [{ label: "Listed on Noble Job", value: postedLabel }] : []),
        ]
      : postedLabel
        // The stored row date is when the listing was ADDED to Noble Job, not the source's
        // publication date — so it is labelled as exactly that.
        ? [{ label: "Listed on Noble Job", value: postedLabel }]
        : []),
    {
      label: "Application Closes",
      value: validLabel ?? "Not stated by the employer — confirm on the application page",
    },
    { label: "Mode of Application", value: MODE_OF_APPLICATION[applyKind] },
    { label: "Job Type", value: empType },
    ...(input.jobId ? [{ label: "Job ID", value: input.jobId }] : []),
  ]

  const faqs = buildFaqs({ ...input, applyKind }, { parsedSalary, fresher, validLabel, cat, where, company })

  return {
    overview,
    aboutOrg,
    responsibilities,
    eligibility,
    skills,
    salaryDetails,
    parsedSalary,
    benefits,
    selectionProcess,
    howToApply,
    importantDates,
    faqs,
    validThrough,
    wordCountHint: estimateWords(overview, aboutOrg, responsibilities, eligibility, benefits, faqs),
  }
}

function buildFaqs(
  input: JobContentInput,
  ctx: { parsedSalary: ParsedSalary | null; fresher: boolean; validLabel: string | null; cat: string; where: string; company: string },
): { q: string; a: string }[] {
  const { title, board, remote } = input
  const company = ctx.company
  return [
    {
      q: `What is the role of ${title} at ${company}?`,
      a: `The ${title} role at ${company} is a ${ctx.cat} position responsible for the duties listed in the Responsibilities section above. You can read the full job overview, eligibility and skill requirements on this page.`,
    },
    {
      q: `What is the salary for the ${title} position?`,
      a: ctx.parsedSalary
        ? `The ${title} role offers ${describeSalary(ctx.parsedSalary)}. The final package depends on your experience, skills and interview performance.`
        : `${company} offers a competitive salary for the ${title} role, benchmarked to ${ctx.cat} industry standards and confirmed during the interview.`,
    },
    {
      q: `Are freshers eligible to apply for this job?`,
      a: ctx.fresher
        ? `Yes. This ${title} opening is open to freshers and early-career candidates. A strong resume and the listed skills will strengthen your application.`
        : `This role prefers candidates with ${input.experience || "relevant"} experience, though motivated applicants who closely match the skills are encouraged to apply.`,
    },
    {
      q: `What qualifications are required for ${title}?`,
      a: `The minimum qualification is ${input.qualification || "as specified by the employer — typically a graduate or diploma"}, along with the core skills listed in the Required Skills section.`,
    },
    {
      q: remote ? `Is this a work-from-home / remote job?` : `Where is this job located?`,
      a: remote
        ? `Yes, this ${title} position is a fully remote work-from-home role that you can do from anywhere in India with a reliable internet connection.`
        : `This ${title} position is based ${ctx.where}. Confirm the exact work location with the employer during the hiring process.`,
    },
    {
      q: `How do I apply for the ${title} job on Noble Job?`,
      a: input.sample
        ? `This is a sample listing, so it cannot be applied to. Browse Noble Job's current openings and apply to a listing that is marked as an active vacancy.`
        : input.applyKind === "closed"
        ? `This job is closed and is no longer accepting applications. Browse Noble Job's current openings to find roles you can still apply for.`
        : input.applyKind === "listing"
        ? `This listing is for information only. It has no application link, and Noble Job does not send applications to an employer for it, so there is nothing to apply to here. Browse Noble Job's current openings and open one with an Apply button.`
        : input.applyKind === "external"
        ? `Use the apply link on this page. It takes you to the original listing on its own website, where you complete the application${ctx.validLabel ? ` before ${ctx.validLabel}` : " as early as you can"}. Noble Job does not receive or forward applications made on that website. Detailed steps are in the How to Apply section.`
        : `Click the "Apply Now" button on this page, keep an updated resume ready, complete the application form and submit it${ctx.validLabel ? ` before ${ctx.validLabel}` : " as early as you can"}. Your application is sent to the employer through Noble Job. Detailed steps are in the How to Apply section.`,
    },
    {
      q: `What is the last date to apply?`,
      a: input.sample
        ? `There is no application date because this is a sample listing, not an open vacancy.`
        : ctx.validLabel
        ? `Applications for this ${title} role close on ${ctx.validLabel}. We recommend applying early, as employers may close listings once enough applications are received.`
        : `The employer has not published a closing date for this ${title} role. We recommend applying early and confirming the deadline on the application page, as employers may close listings once enough applications are received.`,
    },
    {
      q: `Is there any fee to apply through Noble Job?`,
      a: `No. Noble Job never charges candidates to view or apply for jobs. Be cautious of anyone asking for money in the name of a job offer.`,
    },
    {
      q: board === "abroad" ? `Will the employer assist with visa and relocation?` : `What is the selection process?`,
      a:
        board === "abroad"
          ? `Visa, relocation and documentation support vary by employer and country. Confirm these details with the official recruiter before accepting an offer for this ${title} role.`
          : `The selection process typically includes resume screening, an assessment, one or more interviews and final document verification — see the Selection Process section above.`,
    },
    {
      q: `How can I find similar jobs?`,
      a: `Explore the Related Jobs, Government Job and Private Job suggestions on this page, or browse the full ${ctx.cat} and city listings on Noble Job to discover more openings.`,
    },
  ]
}

function estimateWords(...parts: (string | string[] | { q: string; a: string }[])[]): number {
  let text = ""
  for (const p of parts) {
    if (typeof p === "string") text += " " + p
    else if (Array.isArray(p)) {
      for (const item of p) text += " " + (typeof item === "string" ? item : `${item.q} ${item.a}`)
    }
  }
  return text.trim().split(/\s+/).length
}
