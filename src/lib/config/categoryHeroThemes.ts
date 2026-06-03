import type { HeroVariant } from "@/lib/services/heroStatsService"

export interface HeroTheme {
  badge: string
  title: string
  titleAccent?: string
  description: string
  bullets?: string[]
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  gradient: string
  accent: string
  accentMuted: string
  visual: HeroVariant
  anchor?: string
}

const GOVT_BULLETS = ["Daily Notifications", "SSC • UPSC • Railway • Banking • Defence"]

export const CATEGORY_HERO_THEMES: Record<HeroVariant, HeroTheme> = {
  govt: {
    badge: "🏛 Government Jobs Portal",
    title: "Government Jobs",
    titleAccent: "2026",
    description: "Find the latest government opportunities across India — verified notifications, admit cards, and results.",
    bullets: ["25,000+ Vacancies", ...GOVT_BULLETS.slice(1)],
    primaryCta: { label: "Browse Notifications", href: "#govt-jobs" },
    secondaryCta: { label: "Set Job Alert", href: "/jobs/govt#alert" },
    gradient: "linear-gradient(135deg, #0a1635 0%, #1e3a5f 45%, #0d1f4e 100%)",
    accent: "#fbbf24",
    accentMuted: "rgba(251,191,36,.15)",
    visual: "govt",
    anchor: "govt-jobs",
  },
  private: {
    badge: "🏢 Private Sector Careers",
    title: "Find Your",
    titleAccent: "Dream Job",
    description: "Corporate careers from India's most trusted employers — live openings, verified listings, and AI-matched roles.",
    bullets: ["Live inventory counts", "Top employers hiring", "Verified listings daily"],
    primaryCta: { label: "Find Jobs", href: "#private-jobs" },
    secondaryCta: { label: "Upload Resume", href: "/auth?role=candidate&tab=register" },
    gradient: "linear-gradient(135deg, #0d1f4e 0%, #1847d4 55%, #2563eb 100%)",
    accent: "#60a5fa",
    accentMuted: "rgba(96,165,250,.12)",
    visual: "private",
    anchor: "private-jobs",
  },
  wfh: {
    badge: "🏠 Remote Work Hub",
    title: "Work From Home",
    titleAccent: "Jobs",
    description: "Verified remote roles from top Indian and global employers — flexible hours, zero commute, enterprise-grade listings.",
    bullets: ["3,200+ Opportunities", "500+ Live Remote Jobs", "200+ Verified Companies"],
    primaryCta: { label: "Browse WFH Jobs", href: "#wfh-jobs" },
    secondaryCta: { label: "Upload CV", href: "/auth?role=candidate&tab=register" },
    gradient: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 40%, #1847d4 100%)",
    accent: "#c4b5fd",
    accentMuted: "rgba(196,181,253,.15)",
    visual: "wfh",
    anchor: "wfh-jobs",
  },
  abroad: {
    badge: "✈️ International Careers",
    title: "International",
    titleAccent: "Careers",
    description: "Build your global career across 16 countries — Gulf, Europe, North America, and Asia-Pacific.",
    bullets: ["16 Countries", "UAE · Saudi · Qatar", "UK · Canada · Australia", "Germany · Singapore"],
    primaryCta: { label: "Explore Global Jobs", href: "#abroad-jobs" },
    secondaryCta: { label: "Free Consultation", href: "/contact" },
    gradient: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0d1f4e 100%)",
    accent: "#38bdf8",
    accentMuted: "rgba(56,189,248,.12)",
    visual: "abroad",
    anchor: "abroad-jobs",
  },
  banking: {
    badge: "🏦 Banking & Finance",
    title: "Banking",
    titleAccent: "Jobs 2026",
    description: "SBI, IBPS, RBI, NABARD and public-sector bank recruitment — PO, Clerk, SO and specialist officer posts.",
    bullets: ["Bank PO & Clerk", "IBPS CWE", "RBI Grade B", "Pan India"],
    primaryCta: { label: "View Banking Jobs", href: "#govt-jobs" },
    secondaryCta: { label: "All Govt Jobs", href: "/jobs/govt" },
    gradient: "linear-gradient(135deg, #14532d 0%, #166534 40%, #0d1f4e 100%)",
    accent: "#86efac",
    accentMuted: "rgba(134,239,172,.12)",
    visual: "banking",
    anchor: "govt-jobs",
  },
  railway: {
    badge: "🚆 Indian Railways",
    title: "Railway",
    titleAccent: "Jobs 2026",
    description: "RRB and RRC recruitment for NTPC, Group D, ALP, Technician and metro rail positions.",
    bullets: ["RRB NTPC", "Group D", "ALP & Technician", "All Zones"],
    primaryCta: { label: "Railway Notifications", href: "#govt-jobs" },
    secondaryCta: { label: "All Govt Jobs", href: "/jobs/govt" },
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 50%, #0f172a 100%)",
    accent: "#93c5fd",
    accentMuted: "rgba(147,197,253,.12)",
    visual: "railway",
    anchor: "govt-jobs",
  },
  ssc: {
    badge: "📝 Staff Selection Commission",
    title: "SSC",
    titleAccent: "Jobs 2026",
    description: "SSC CGL, CHSL, MTS, GD Constable and other central government graduate & matric level exams.",
    bullets: ["SSC CGL", "SSC CHSL", "SSC MTS", "SSC GD"],
    primaryCta: { label: "SSC Notifications", href: "#govt-jobs" },
    secondaryCta: { label: "Exam Calendar", href: "/jobs/govt" },
    gradient: "linear-gradient(135deg, #312e81 0%, #4338ca 50%, #0d1f4e 100%)",
    accent: "#a5b4fc",
    accentMuted: "rgba(165,180,252,.12)",
    visual: "ssc",
    anchor: "govt-jobs",
  },
  upsc: {
    badge: "🏛 Union Public Service Commission",
    title: "UPSC",
    titleAccent: "Jobs 2026",
    description: "Civil Services, CDS, NDA, CAPF, IES and other prestigious Union Public Service Commission examinations.",
    bullets: ["Civil Services", "CDS / NDA", "CAPF", "Engineering Services"],
    primaryCta: { label: "UPSC Notifications", href: "#govt-jobs" },
    secondaryCta: { label: "All Govt Jobs", href: "/jobs/govt" },
    gradient: "linear-gradient(135deg, #7c2d12 0%, #b45309 45%, #0d1f4e 100%)",
    accent: "#fcd34d",
    accentMuted: "rgba(252,211,77,.15)",
    visual: "upsc",
    anchor: "govt-jobs",
  },
  defence: {
    badge: "🪖 National Defence",
    title: "Defence",
    titleAccent: "Jobs 2026",
    description: "Indian Army, Navy, Air Force, DRDO, Coast Guard and Agniveer recruitment across India.",
    bullets: ["Army Agniveer", "Navy Sailor", "IAF Airmen", "DRDO Scientist"],
    primaryCta: { label: "Defence Jobs", href: "#govt-jobs" },
    secondaryCta: { label: "All Govt Jobs", href: "/jobs/govt" },
    gradient: "linear-gradient(135deg, #14532d 0%, #166534 35%, #1c1917 100%)",
    accent: "#4ade80",
    accentMuted: "rgba(74,222,128,.12)",
    visual: "defence",
    anchor: "govt-jobs",
  },
  police: {
    badge: "👮 Police & CAPF",
    title: "Police",
    titleAccent: "Jobs 2026",
    description: "State police constable, SI, CAPF, CRPF, BSF and paramilitary force recruitment notifications.",
    bullets: ["State Police", "CAPF", "CRPF / BSF", "Constable & SI"],
    primaryCta: { label: "Police Notifications", href: "#govt-jobs" },
    secondaryCta: { label: "All Govt Jobs", href: "/jobs/govt" },
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #0f172a 100%)",
    accent: "#60a5fa",
    accentMuted: "rgba(96,165,250,.12)",
    visual: "police",
    anchor: "govt-jobs",
  },
  teaching: {
    badge: "🍎 Teaching & Education",
    title: "Teaching",
    titleAccent: "Jobs 2026",
    description: "KVS, NVS, UGC NET, state TET and university faculty recruitment for teachers and professors.",
    bullets: ["KVS / NVS", "CTET / TET", "UGC NET", "Faculty Posts"],
    primaryCta: { label: "Teaching Jobs", href: "#govt-jobs" },
    secondaryCta: { label: "All Govt Jobs", href: "/jobs/govt" },
    gradient: "linear-gradient(135deg, #9d174d 0%, #be185d 40%, #0d1f4e 100%)",
    accent: "#f9a8d4",
    accentMuted: "rgba(249,168,212,.12)",
    visual: "teaching",
    anchor: "govt-jobs",
  },
  engineering: {
    badge: "🛠 Government Engineering",
    title: "Engineering",
    titleAccent: "Jobs 2026",
    description: "Junior Engineer, Assistant Engineer and technical cadre recruitment in railways, PWD, state PSC and PSUs.",
    bullets: ["JE / AE Posts", "Diploma & B.Tech", "Railway & PSU", "Pan India"],
    primaryCta: { label: "Engineering Jobs", href: "#govt-jobs" },
    secondaryCta: { label: "All Govt Jobs", href: "/jobs/govt" },
    gradient: "linear-gradient(135deg, #0f766e 0%, #0d9488 45%, #0d1f4e 100%)",
    accent: "#5eead4",
    accentMuted: "rgba(94,234,212,.12)",
    visual: "engineering",
    anchor: "govt-jobs",
  },
  psu: {
    badge: "⚙️ Public Sector Undertakings",
    title: "PSU",
    titleAccent: "Jobs 2026",
    description: "ONGC, NTPC, BHEL, GAIL, IOCL, Coal India and other Maharatna / Navratna PSU recruitment.",
    bullets: ["Maharatna PSUs", "Engineering", "Management Trainee", "Pan India"],
    primaryCta: { label: "PSU Notifications", href: "#govt-jobs" },
    secondaryCta: { label: "All Govt Jobs", href: "/jobs/govt" },
    gradient: "linear-gradient(135deg, #374151 0%, #4b5563 40%, #0d1f4e 100%)",
    accent: "#d1d5db",
    accentMuted: "rgba(209,213,219,.12)",
    visual: "psu",
    anchor: "govt-jobs",
  },
}

export function getHeroTheme(variant: HeroVariant) {
  return CATEGORY_HERO_THEMES[variant] ?? CATEGORY_HERO_THEMES.govt
}

/** Map govt category slug → hero variant */
export function govtSlugToHeroVariant(slug: string): HeroVariant | null {
  const map: Record<string, HeroVariant> = {
    banking: "banking",
    railway: "railway",
    ssc: "ssc",
    upsc: "upsc",
    defence: "defence",
    police: "police",
    teaching: "teaching",
    psu: "psu",
    engineering: "engineering",
    "latest-notifications": "govt",
    "all-india": "govt",
    "state-govt": "govt",
  }
  return map[slug] ?? null
}
