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
  postedAt?: string
  remote?: boolean
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
  validThrough: string          // ISO — also fed to JobPosting schema
  /** HTML description for the JobPosting schema `description` field. */
  schemaDescriptionHtml: string
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

function addDaysIso(fromIso: string | undefined, days: number): string {
  const base = fromIso ? new Date(fromIso) : new Date()
  const d = Number.isNaN(base.getTime()) ? new Date() : base
  return new Date(d.getTime() + days * 86400000).toISOString()
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
  const postedDate = input.postedAt ? new Date(input.postedAt) : new Date()
  const postedLabel = Number.isNaN(postedDate.getTime())
    ? new Date().toDateString()
    : postedDate.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
  const validThrough = addDaysIso(input.postedAt, 30)
  const validLabel = new Date(validThrough).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })

  const overview: string[] = [
    `${company} is hiring for the position of ${input.title} ${where}. This is a ${empType.toLowerCase()} opportunity in the ${cat} domain, listed on Noble Job — India's trusted job portal by NCC Foundation. ${fresher ? "Freshers and early-career candidates are encouraged to apply." : `Candidates with ${input.experience} of relevant experience are preferred.`} ${parsedSalary ? `The role offers a competitive package of ${describeSalary(parsedSalary)}.` : "Compensation is competitive and discussed during the interview."}`,
    `As a ${input.title}, you will work within ${company}'s ${profile.domain} function. ${input.description ? input.description.trim() + " " : ""}The position is well suited to professionals who are organised, dependable and keen to grow their career in ${cat}. You will use ${profile.tools} as part of your everyday work and collaborate closely with a supportive team.`,
    `This listing covers everything you need before applying — the full job overview, responsibilities, eligibility and required skills, salary and benefits, the selection process, step-by-step application instructions, and answers to the most frequently asked questions. Review the details below and apply before the closing date of ${validLabel}.`,
  ]

  const aboutOrg = `${company} is a recognised employer in the ${cat} space and a sought-after destination for ${input.board === "abroad" ? "international" : "Indian"} job seekers. The organisation invests in its people through structured onboarding, mentoring and clear growth paths. By hiring through Noble Job, ${company} reaches verified, job-ready candidates across India. Always confirm the latest company and role information on the official application page before submitting your application.`

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

  const applyVerb = input.board === "abroad" ? "the official recruiter / company portal" : "Noble Job"
  const howToApply: string[] = [
    `Read this complete job listing for the ${input.title} role to confirm you meet the eligibility criteria.`,
    "Keep an updated resume highlighting your relevant skills, experience and achievements ready.",
    `Click the "Apply Now" button on this page to proceed to ${applyVerb}.`,
    "Fill in the application form accurately and attach your resume and any required documents.",
    `Submit your application before the closing date of ${validLabel} and watch your email for next steps.`,
  ]

  const importantDates = [
    { label: "Job Posted On", value: postedLabel },
    { label: "Application Closes", value: validLabel },
    { label: "Mode of Application", value: "Online" },
    { label: "Job Type", value: empType },
  ]

  const faqs = buildFaqs(input, { parsedSalary, fresher, validLabel, cat, where, company })

  // HTML description used for the JobPosting schema (Google prefers HTML).
  const schemaDescriptionHtml =
    `<p>${overview[0]}</p>` +
    `<p><strong>Key Responsibilities:</strong></p><ul>${responsibilities.map(r => `<li>${r}</li>`).join("")}</ul>` +
    `<p><strong>Required Skills:</strong> ${skills.join(", ")}.</p>` +
    `<p><strong>Eligibility:</strong></p><ul>${eligibility.map(e => `<li>${e}</li>`).join("")}</ul>` +
    `<p><strong>Benefits:</strong> ${benefits.join(", ")}.</p>`

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
    schemaDescriptionHtml,
    wordCountHint: estimateWords(overview, aboutOrg, responsibilities, eligibility, benefits, faqs),
  }
}

function buildFaqs(
  input: JobContentInput,
  ctx: { parsedSalary: ParsedSalary | null; fresher: boolean; validLabel: string; cat: string; where: string; company: string },
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
      a: `Click the "Apply Now" button on this page, keep an updated resume ready, complete the application form and submit it before ${ctx.validLabel}. Detailed steps are in the How to Apply section.`,
    },
    {
      q: `What is the last date to apply?`,
      a: `Applications for this ${title} role close on ${ctx.validLabel}. We recommend applying early, as employers may close listings once enough applications are received.`,
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
