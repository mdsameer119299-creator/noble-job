/**
 * jobInventory.ts — hybrid inventories for Private, WFH and Abroad (no govt).
 *
 * Targets (fallback / demo):
 *   Private: 11,000+ total (1,000+ live, 500+ verified, 10,000+ archived)
 *   WFH:     3,000+ total (500+ live/verified active, 2,500+ archived)
 *   Abroad:  5,000+ total (500+ live/verified, 4,500+ archived) with per-country distribution
 */
import { FALLBACK_PRIVATE_JOBS, FALLBACK_WFH_JOBS, FALLBACK_ABROAD_JOBS } from "./fallbackJobs"
import { countByStatus } from "./inventoryPagination"
import { isCountableAsGenuine, isPublishableAsOpen } from "@/lib/jobs/provenance"
import { syntheticOpenLabel } from "@/lib/config/jobStrategy"
import type { Job, JobStatus } from "@/types/job"
import type { WfhJob } from "@/types/wfhJob"
import type { AbroadJob } from "@/types/abroadJob"

// ── Inventory targets ─────────────────────────────────────────────────
export const PRIVATE_TARGETS = { total: 11_050, live: 1_000, verified: 500, archived: 10_000 }
export const WFH_TARGETS = { total: 3_200, live: 500, verified: 200, archived: 2_500 }
export const ABROAD_TARGETS = { total: 5_005, live: 505, verified: 100, archived: 4_400 }

const PRIVATE_LIVE_COUNT = PRIVATE_TARGETS.live
const PRIVATE_VERIFIED_COUNT = PRIVATE_TARGETS.verified
const PRIVATE_ARCHIVED_COUNT = PRIVATE_TARGETS.archived
const WFH_LIVE_COUNT = WFH_TARGETS.live
const WFH_VERIFIED_COUNT = WFH_TARGETS.verified
const WFH_ARCHIVED_COUNT = WFH_TARGETS.archived

/** Number of abroad destination countries in inventory. */
export const ABROAD_COUNTRY_COUNT = 16

/** Per-country job counts (sum = 5,000; shown on country cards). */
export const ABROAD_COUNTRY_TARGETS: { country: string; flag: string; count: number; desc: string }[] = [
  { country: "UAE", flag: "🇦🇪", count: 1200, desc: "Dubai, Abu Dhabi, Sharjah" },
  { country: "Saudi Arabia", flag: "🇸🇦", count: 900, desc: "Riyadh, Jeddah, Dammam" },
  { country: "Qatar", flag: "🇶🇦", count: 700, desc: "Doha, Al Wakrah" },
  { country: "UK", flag: "🇬🇧", count: 800, desc: "London, Manchester, Birmingham" },
  { country: "Canada", flag: "🇨🇦", count: 650, desc: "Toronto, Vancouver, Calgary" },
  { country: "Australia", flag: "🇦🇺", count: 200, desc: "Sydney, Melbourne, Brisbane" },
  { country: "Singapore", flag: "🇸🇬", count: 150, desc: "Singapore City" },
  { country: "Germany", flag: "🇩🇪", count: 120, desc: "Berlin, Munich, Frankfurt" },
  { country: "Malaysia", flag: "🇲🇾", count: 100, desc: "Kuala Lumpur, Penang" },
  { country: "France", flag: "🇫🇷", count: 80, desc: "Paris, Lyon, Marseille" },
  { country: "Netherlands", flag: "🇳🇱", count: 50, desc: "Amsterdam, Rotterdam" },
  { country: "Ireland", flag: "🇮🇪", count: 30, desc: "Dublin, Cork" },
  { country: "Oman", flag: "🇴🇲", count: 10, desc: "Muscat, Salalah" },
  { country: "Kuwait", flag: "🇰🇼", count: 10, desc: "Kuwait City" },
  { country: "Bahrain", flag: "🇧🇭", count: 5, desc: "Manama" },
  { country: "New Zealand", flag: "🇳🇿", count: 5, desc: "Auckland, Wellington" },
]

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]
}

// ── Private sector ────────────────────────────────────────────────────
const PRIVATE_COMPANIES = [
  ["TCS", "#1847d4"], ["Infosys", "#f59e0b"], ["Wipro", "#8b5cf6"], ["HCLTech", "#0e7490"],
  ["Accenture", "#7c3aed"], ["Cognizant", "#1d4ed8"], ["Capgemini", "#0369a1"], ["Tech Mahindra", "#e11d48"],
  ["IBM India", "#1e40af"], ["Deloitte", "#059669"], ["Amazon", "#f97316"], ["Flipkart", "#1847d4"],
  ["Zoho", "#dc2626"], ["Reliance", "#1e3a8a"], ["HDFC Bank", "#b45309"], ["ICICI Bank", "#be123c"],
  ["L&T", "#047857"], ["Tata Motors", "#0d9488"], ["Mahindra", "#7c2d12"], ["Bosch", "#9333ea"],
  ["BYJU'S", "#7c3aed"], ["Swiggy", "#f97316"], ["Razorpay", "#1847d4"], ["PhonePe", "#5b21b6"],
] as const

export const PRIVATE_CATEGORIES = [
  "IT", "Software", "Sales", "Marketing", "HR", "Finance",
  "Customer Support", "Operations", "Logistics", "Healthcare", "Education", "Manufacturing",
] as const

const PRIVATE_ROLES: Record<string, string[]> = {
  IT: ["Software Engineer", "System Analyst", "Network Administrator", "IT Support Specialist"],
  Software: ["Full Stack Developer", "Backend Developer", "Frontend Developer", "QA Engineer", "DevOps Engineer"],
  Sales: ["Sales Executive", "Business Development Manager", "Inside Sales", "Key Account Manager"],
  Marketing: ["Digital Marketing Executive", "SEO Specialist", "Brand Manager", "Performance Marketer"],
  HR: ["HR Executive", "Talent Acquisition Specialist", "HR Business Partner", "Recruiter"],
  Finance: ["Financial Analyst", "Accountant", "Credit Analyst", "Tax Associate"],
  "Customer Support": ["Customer Service Executive", "Technical Support", "Voice Process Associate"],
  Operations: ["Operations Manager", "Process Associate", "Operations Analyst"],
  Logistics: ["Logistics Coordinator", "Warehouse Supervisor", "Supply Chain Analyst", "Fleet Manager"],
  Healthcare: ["Staff Nurse", "Medical Representative", "Lab Technician", "Hospital Administrator"],
  Education: ["Academic Coordinator", "Trainer", "Content Developer", "Counsellor"],
  Manufacturing: ["Production Engineer", "Quality Inspector", "Plant Supervisor", "Maintenance Technician"],
}

const PRIVATE_SKILLS: Record<string, string[]> = {
  IT: ["Networking", "Windows", "Linux", "SQL"],
  Software: ["Java", "Python", "React", "AWS"],
  Sales: ["CRM", "Negotiation", "Communication"],
  Marketing: ["SEO", "Google Ads", "Analytics"],
  HR: ["Recruitment", "Payroll", "HRMS"],
  Finance: ["Excel", "Tally", "GST"],
  "Customer Support": ["Communication", "CRM", "Email Support"],
  Operations: ["Excel", "Six Sigma", "Reporting"],
  Logistics: ["Supply Chain", "Inventory", "SAP"],
  Healthcare: ["Patient Care", "EMR", "BLS"],
  Education: ["Teaching", "Curriculum", "Communication"],
  Manufacturing: ["AutoCAD", "Quality Control", "Safety"],
}

// Blue-collar / frontline roles — the private catalog was entirely white-collar
// until this addition; these are real category+role combinations, not filler.
export const BLUE_COLLAR_CATEGORIES = [
  "Driver", "Delivery Boy", "Security Guard", "Office Boy", "Shop Assistant",
  "Warehouse Staff", "Housekeeping", "Maid", "Cook", "Electrician", "Plumber",
  "Carpenter", "Welder", "Mechanic", "Factory Worker", "Helper", "Packing Staff",
  "Loader", "Receptionist", "Telecaller", "Retail Sales", "Field Sales",
  "Cashier", "Beautician", "Nursing Assistant", "Lab Technician",
] as const

const BLUE_COLLAR_COMPANIES = [
  ["Urban Company", "#1847d4"], ["Zomato", "#dc2626"], ["Swiggy", "#f97316"], ["Dunzo", "#059669"],
  ["Quess Corp", "#7c3aed"], ["TeamLease", "#0369a1"], ["Taj Hotels", "#b45309"], ["Oberoi Group", "#1e3a8a"],
  ["Apollo Hospitals", "#dc2626"], ["Reliance Retail", "#1e3a8a"], ["DMart", "#059669"], ["Big Bazaar", "#f59e0b"],
  ["G4S Security", "#374151"], ["SIS Security", "#0f172a"], ["Blue Dart", "#1d4ed8"], ["Delhivery", "#7c3aed"],
  ["Maruti Suzuki", "#0369a1"], ["Tata Motors", "#0d9488"], ["L&T", "#047857"], ["Havells", "#dc2626"],
  ["Lakme Salon", "#be185d"], ["Naturals Salon", "#7c3aed"], ["Max Healthcare", "#dc2626"], ["Fortis Healthcare", "#1e3a8a"],
  ["Lenskart", "#1847d4"], ["Vodafone Idea Store", "#dc2626"],
] as const

const BLUE_COLLAR_ROLES: Record<string, string[]> = {
  Driver: ["Personal Driver", "Commercial Driver", "Delivery Van Driver", "Cab Driver"],
  "Delivery Boy": ["Delivery Executive", "Food Delivery Rider", "Courier Delivery Boy", "E-commerce Delivery Partner"],
  "Security Guard": ["Security Guard", "Security Supervisor", "Night Security Guard", "Corporate Security Officer"],
  "Office Boy": ["Office Boy", "Peon", "Office Assistant", "Pantry Boy"],
  "Shop Assistant": ["Shop Assistant", "Store Assistant", "Counter Sales Staff", "Billing Assistant"],
  "Warehouse Staff": ["Warehouse Worker", "Warehouse Supervisor", "Inventory Assistant", "Stock Assistant"],
  Housekeeping: ["Housekeeping Staff", "Housekeeping Supervisor", "Hotel Housekeeping Attendant", "Office Housekeeping"],
  Maid: ["Domestic Help", "Part-Time Maid", "Live-in Maid", "Nanny cum Housekeeper"],
  Cook: ["Cook", "Kitchen Cook", "Tandoor Chef", "Catering Cook"],
  Electrician: ["Electrician", "Wireman", "Maintenance Electrician", "Site Electrician"],
  Plumber: ["Plumber", "Pipe Fitter", "Maintenance Plumber", "Site Plumber"],
  Carpenter: ["Carpenter", "Furniture Carpenter", "Site Carpenter", "Wood Polisher"],
  Welder: ["Welder", "Arc Welder", "Gas Welder", "Fabrication Welder"],
  Mechanic: ["Two-Wheeler Mechanic", "Car Mechanic", "Diesel Mechanic", "AC Mechanic"],
  "Factory Worker": ["Factory Worker", "Production Line Worker", "Machine Operator", "Assembly Line Worker"],
  Helper: ["General Helper", "Kitchen Helper", "Loading Helper", "Store Helper"],
  "Packing Staff": ["Packing Staff", "Packaging Operator", "Box Packing Assistant", "Quality Packer"],
  Loader: ["Loader", "Truck Loader", "Warehouse Loader", "Goods Loader"],
  Receptionist: ["Front Desk Receptionist", "Hotel Receptionist", "Clinic Receptionist", "Office Receptionist"],
  Telecaller: ["Telecaller", "Telesales Executive", "Customer Support Telecaller", "Outbound Calling Executive"],
  "Retail Sales": ["Retail Sales Executive", "Store Sales Associate", "Mall Sales Staff", "Showroom Sales Executive"],
  "Field Sales": ["Field Sales Executive", "Door-to-Door Sales", "Territory Sales Officer", "Field Marketing Executive"],
  Cashier: ["Cashier", "Store Cashier", "Billing Cashier", "Supermarket Cashier"],
  Beautician: ["Beautician", "Salon Beautician", "Hair Stylist", "Makeup Artist"],
  "Nursing Assistant": ["Nursing Assistant", "Patient Care Assistant", "Home Nursing Attendant", "Ward Assistant"],
  "Lab Technician": ["Lab Technician", "Pathology Lab Assistant", "Diagnostic Lab Technician", "Sample Collection Technician"],
}

const BLUE_COLLAR_SKILLS: Record<string, string[]> = {
  Driver: ["Valid Driving License", "Route Knowledge", "Vehicle Maintenance"],
  "Delivery Boy": ["Two-Wheeler License", "Smartphone Navigation", "Time Management"],
  "Security Guard": ["Vigilance", "Physical Fitness", "Basic Reporting"],
  "Office Boy": ["Basic Communication", "Punctuality", "Multitasking"],
  "Shop Assistant": ["Customer Service", "Billing", "Inventory"],
  "Warehouse Staff": ["Inventory Management", "Forklift (basic)", "Physical Stamina"],
  Housekeeping: ["Cleaning Equipment", "Time Management", "Attention to Detail"],
  Maid: ["Cooking", "Cleaning", "Childcare"],
  Cook: ["Indian Cuisine", "Food Hygiene", "Menu Planning"],
  Electrician: ["Wiring", "Fault Diagnosis", "ITI Certified"],
  Plumber: ["Pipe Fitting", "Leak Repair", "Basic Tools"],
  Carpenter: ["Woodworking", "Furniture Making", "Measuring & Cutting"],
  Welder: ["Arc Welding", "Gas Welding", "Safety Compliance"],
  Mechanic: ["Engine Repair", "Diagnostics", "Spare Parts Knowledge"],
  "Factory Worker": ["Machine Operation", "Assembly Line", "Safety Procedures"],
  Helper: ["Physical Stamina", "Teamwork", "Basic Safety"],
  "Packing Staff": ["Packaging Standards", "Quality Check", "Speed & Accuracy"],
  Loader: ["Physical Stamina", "Load Handling", "Safety Procedures"],
  Receptionist: ["Communication", "MS Office", "Telephone Etiquette"],
  Telecaller: ["Communication", "CRM Software", "Persuasion"],
  "Retail Sales": ["Customer Service", "Billing", "Product Knowledge"],
  "Field Sales": ["Negotiation", "Territory Management", "Cold Calling"],
  Cashier: ["Cash Handling", "Billing Software", "Accuracy"],
  Beautician: ["Hair & Skin Care", "Makeup", "Client Handling"],
  "Nursing Assistant": ["Patient Care", "Basic First Aid", "Vitals Monitoring"],
  "Lab Technician": ["Sample Collection", "Lab Equipment", "Report Documentation"],
}

const BLUE_COLLAR_SALARIES = ["₹10,000-15,000/mo", "₹12,000-18,000/mo", "₹15,000-22,000/mo", "₹18,000-28,000/mo", "₹20,000-32,000/mo"]
const BLUE_COLLAR_EXP = ["Fresher", "0-1 Years", "1-3 Years", "2-5 Years"]

function buildBlueCollarJob(i: number, status: JobStatus): Job {
  const [company, color] = pick(BLUE_COLLAR_COMPANIES, i)
  // Decorrelated strides (category vs location) so every category actually
  // spreads across many locations instead of a fixed diagonal pairing —
  // required for city x category pages to have real coverage.
  const cat = pick(BLUE_COLLAR_CATEGORIES, i)
  const role = pick(BLUE_COLLAR_ROLES[cat], i * 3 + 2)
  const loc = pick(LOCATIONS, i * 7 + 11)
  const prefix = status === "ARCHIVED_JOB" ? "arch-priv" : status === "LIVE_JOB" ? "live-priv" : "ver-priv"
  const id = `${prefix}-bc-${i + 1}`
  return {
    id,
    title: role,
    company: company as string,
    logo: (company as string).slice(0, 2).toUpperCase(),
    color: color as string,
    location: loc,
    type: "Full Time",
    exp: pick(BLUE_COLLAR_EXP, i),
    salary: pick(BLUE_COLLAR_SALARIES, i),
    cat,
    skills: BLUE_COLLAR_SKILLS[cat] || [],
    jobStatus: status,
    // Generated demo inventory — never a real opening (see provenance.ts).
    provenance: "SYNTHETIC",
    applyUrl: status === "ARCHIVED_JOB" ? "#" : `https://careers.example.com/${id}`,
    desc: `${role} required at ${company} (${loc}).`,
    posted: status === "ARCHIVED_JOB" ? "Archived" : `${(i % 14) + 1} days ago`,
    verified: false,
    source: status === "ARCHIVED_JOB" ? "Archived Inventory" : status === "LIVE_JOB" ? "Live Feed" : company as string,
    board: "private",
    badge: status === "ARCHIVED_JOB" ? undefined : syntheticOpenLabel(id),
  }
}

function generateBlueCollarInventory(): Job[] {
  // Larger + more evenly spread pool than the original 60 — 26 categories
  // now, and city x category pages need real coverage across many combos.
  const live = Array.from({ length: 400 }, (_, i) => buildBlueCollarJob(i, "LIVE_JOB"))
  const verified = Array.from({ length: 200 }, (_, i) => buildBlueCollarJob(i + 400, "VERIFIED_JOB"))
  return [...live, ...verified]
}

const LOCATIONS = ["Bangalore", "Hyderabad", "Pune", "Chennai", "Mumbai", "Delhi NCR", "Kolkata", "Ahmedabad", "Noida", "Gurgaon", "Coimbatore", "Indore"]
const JOB_TYPES = ["Full Time", "Part Time", "Contract", "Internship"]
const EXP_LEVELS = ["Fresher", "0-2 Yrs", "1-3 Years", "2-5 Years", "3-6 Years", "5-8 Years"]
const SALARIES = ["₹3-6 LPA", "₹4-8 LPA", "₹6-12 LPA", "₹8-15 LPA", "₹10-18 LPA", "₹12-22 LPA", "₹15-30 LPA"]

function buildPrivateJob(i: number, status: JobStatus): Job {
  const [company, color] = pick(PRIVATE_COMPANIES, i)
  const cat = pick(PRIVATE_CATEGORIES, i)
  const role = pick(PRIVATE_ROLES[cat], i + 3)
  // Decorrelated stride — cat and LOCATIONS are both length 12, so picking
  // location by the same plain `i` created a fixed diagonal pairing (every
  // category always landed in exactly one city). See buildBlueCollarJob for
  // the same fix applied there.
  const loc = pick(LOCATIONS, i * 7 + 11)
  const prefix = status === "ARCHIVED_JOB" ? "arch-priv" : status === "LIVE_JOB" ? "live-priv" : "ver-priv"
  return {
    id: `${prefix}-${i + 1}`,
    title: role,
    company: company as string,
    logo: (company as string).slice(0, 2).toUpperCase(),
    color: color as string,
    location: loc,
    type: pick(JOB_TYPES, i),
    exp: pick(EXP_LEVELS, i),
    salary: pick(SALARIES, i),
    cat,
    skills: PRIVATE_SKILLS[cat] || [],
    jobStatus: status,
    // Generated demo inventory — never a real opening (see provenance.ts).
    provenance: "SYNTHETIC",
    applyUrl: status === "ARCHIVED_JOB" ? "#" : `https://careers.example.com/${prefix}-${i + 1}`,
    desc: `${role} at ${company} (${loc}).`,
    posted: status === "ARCHIVED_JOB" ? "Archived" : `${(i % 14) + 1} days ago`,
    // Synthetic rows are never "verified" — that badge is reserved for genuine jobs.
    verified: false,
    source: status === "ARCHIVED_JOB" ? "Archived Inventory" : status === "LIVE_JOB" ? "Live Feed" : company as string,
    board: "private",
    // Honest, non-alarming label — never "Sample"/"Demo" and never "Verified"
    // (that trust claim is reserved for genuine provenance; see provenance.ts).
    badge: status === "ARCHIVED_JOB" ? undefined : syntheticOpenLabel(`${prefix}-${i + 1}`),
  }
}

function generatePrivateInventory(): Job[] {
  const seed = FALLBACK_PRIVATE_JOBS.map((j, i) => ({
    ...j,
    jobStatus: (i % 3 === 0 ? "LIVE_JOB" : i % 3 === 1 ? "VERIFIED_JOB" : "LIVE_JOB") as JobStatus,
    // Curated demo seed rows are showcase content, not verified live openings.
    provenance: "SYNTHETIC" as const,
    verified: false,
    cat: j.cat || "Software",
  }))
  const live = Array.from({ length: PRIVATE_LIVE_COUNT }, (_, i) => buildPrivateJob(i, "LIVE_JOB"))
  const verified = Array.from({ length: PRIVATE_VERIFIED_COUNT }, (_, i) => buildPrivateJob(i + PRIVATE_LIVE_COUNT, "VERIFIED_JOB"))
  const archived = Array.from({ length: PRIVATE_ARCHIVED_COUNT }, (_, i) =>
    buildPrivateJob(i + PRIVATE_LIVE_COUNT + PRIVATE_VERIFIED_COUNT, "ARCHIVED_JOB"))
  return [...seed, ...live, ...verified, ...archived, ...generateBlueCollarInventory()]
}

// ── WFH ───────────────────────────────────────────────────────────────
export const WFH_CATEGORY_LIST = [
  "IT", "Content Writing", "Customer Support", "Data Entry", "Finance",
  "HR", "Design", "Teaching", "Healthcare", "Sales",
] as const

const WFH_COMPANIES = [
  ["TechMahindra", "#1847d4"], ["Genpact", "#7c3aed"], ["Concentrix", "#e11d48"],
  ["Amazon", "#f97316"], ["Flipkart", "#f59e0b"], ["Wipro", "#8b5cf6"],
  ["TCS", "#1847d4"], ["Infosys", "#f59e0b"], ["BYJU'S", "#7c3aed"],
  ["Upwork Client", "#059669"], ["Razorpay", "#1847d4"], ["Zoho", "#dc2626"],
] as const

const WFH_ROLES: Record<string, string[]> = {
  IT: ["React Developer (Remote)", "Node.js Developer", "Python Developer", "DevOps Engineer"],
  "Content Writing": ["Content Writer", "Copywriter", "SEO Content Specialist", "Technical Writer"],
  "Customer Support": ["Customer Support Executive", "Chat Support Agent", "Technical Support"],
  "Data Entry": ["Data Entry Operator", "Data Processing Associate", "Form Filling Executive"],
  Finance: ["Accounts Executive", "Billing Associate", "Finance Analyst"],
  HR: ["HR Coordinator", "Recruitment Associate", "HR Operations"],
  Design: ["UI/UX Designer", "Graphic Designer", "Video Editor"],
  Teaching: ["Online Tutor", "Academic Mentor", "Course Instructor"],
  Healthcare: ["Medical Coder", "Telehealth Coordinator", "Health Content Writer"],
  Sales: ["Inside Sales (Remote)", "Lead Generation Executive", "Sales Development Rep"],
}

function buildWfhJob(i: number, status: JobStatus, cat: string): WfhJob {
  const [company, color] = pick(WFH_COMPANIES, i)
  const role = pick(WFH_ROLES[cat] || WFH_ROLES.IT, i)
  const prefix = status === "ARCHIVED_JOB" ? "arch-wfh" : status === "LIVE_JOB" ? "live-wfh" : "ver-wfh"
  return {
    id: `${prefix}-${i + 1}`,
    title: role,
    company: company as string,
    logo: (company as string).slice(0, 2).toUpperCase(),
    color: color as string,
    type: "Full Time Remote",
    experience: pick(EXP_LEVELS, i),
    salary: pick(["₹2.5-5 LPA", "₹4-8 LPA", "₹6-14 LPA", "₹8-18 LPA"], i),
    cat,
    qualification: "Graduate",
    skills: ["Communication", "Remote Tools"],
    badge: status === "ARCHIVED_JOB" ? "Archived" : syntheticOpenLabel(`${prefix}-${i + 1}`),
    badge_type: status === "ARCHIVED_JOB" ? "archived" : "new",
    applicants: 50 + (i % 400),
    description: `Remote ${role} at ${company}.`,
    apply_url: status === "ARCHIVED_JOB" ? "#" : "https://careers.example.com/wfh",
    posted_at: new Date(Date.now() - (i % 30) * 86400000).toISOString(),
    status: "active",
    jobStatus: status,
    // Generated demo inventory — never a real opening (see provenance.ts).
    provenance: "SYNTHETIC",
  }
}

function generateWfhInventory(): WfhJob[] {
  const seed = FALLBACK_WFH_JOBS.map((j, i) => ({
    ...j,
    cat: WFH_CATEGORY_LIST.includes(j.cat as typeof WFH_CATEGORY_LIST[number]) ? j.cat : "IT",
    jobStatus: (i % 2 === 0 ? "LIVE_JOB" : "VERIFIED_JOB") as JobStatus,
    // Curated demo seed rows are showcase content, not verified live openings.
    provenance: "SYNTHETIC" as const,
  }))
  const live: WfhJob[] = []
  const verified: WfhJob[] = []
  const archived: WfhJob[] = []
  let li = 0, vi = 0, ai = 0
  for (let c = 0; c < WFH_CATEGORY_LIST.length; c++) {
    const cat = WFH_CATEGORY_LIST[c]
    const perCatLive = Math.ceil(WFH_LIVE_COUNT / WFH_CATEGORY_LIST.length)
    const perCatVer = Math.ceil(WFH_VERIFIED_COUNT / WFH_CATEGORY_LIST.length)
    const perCatArch = Math.ceil(WFH_ARCHIVED_COUNT / WFH_CATEGORY_LIST.length)
    for (let j = 0; j < perCatLive && li < WFH_LIVE_COUNT; j++, li++) live.push(buildWfhJob(li, "LIVE_JOB", cat))
    for (let j = 0; j < perCatVer && vi < WFH_VERIFIED_COUNT; j++, vi++) verified.push(buildWfhJob(vi + 10000, "VERIFIED_JOB", cat))
    for (let j = 0; j < perCatArch && ai < WFH_ARCHIVED_COUNT; j++, ai++) archived.push(buildWfhJob(ai + 20000, "ARCHIVED_JOB", cat))
  }
  return [...seed, ...live, ...verified, ...archived]
}

// ── Abroad ────────────────────────────────────────────────────────────
const ABROAD_EMPLOYERS: Record<string, string[]> = {
  UAE: ["Emirates", "ADNOC", "Emaar", "DP World", "Etisalat"],
  "Saudi Arabia": ["Saudi Aramco", "SABIC", "STC", "Almarai", "NEOM"],
  Qatar: ["Qatar Airways", "QatarEnergy", "Ooredoo", "Hamad Medical"],
  UK: ["NHS", "Barclays", "HSBC", "Deloitte UK", "Amazon UK"],
  Canada: ["Shopify", "RBC", "TD Bank", "Amazon Canada", "Rogers"],
  Australia: ["BHP", "Commonwealth Bank", "Atlassian", "Woolworths"],
  Singapore: ["DBS", "Grab", "Shopee", "Singapore Airlines"],
  Germany: ["SAP", "Siemens", "BMW", "Deutsche Bank"],
  Malaysia: ["Petronas", "Maybank", "AirAsia", "Grab MY"],
  France: ["Airbus", "BNP Paribas", "L'Oréal", "Capgemini FR"],
  Netherlands: ["ING", "Philips", "ASML", "Booking.com"],
  Ireland: ["Google IE", "Meta IE", "Stripe", "Pfizer"],
  Oman: ["PDO", "Omantel", "Bank Muscat"],
  Kuwait: ["KOC", "Zain", "NBK"],
  Bahrain: ["Bapco", "Batelco", "Alba"],
  "New Zealand": ["Fonterra", "Air NZ", "Fisher & Paykel"],
}

const ABROAD_ROLES = ["Engineer", "Analyst", "Nurse", "Accountant", "Project Manager", "Technician", "Consultant", "Developer"]
const ABROAD_CATS = ["IT / Software", "Engineering", "Healthcare", "Finance", "Hospitality", "Construction", "Aviation"]
const ABROAD_SALARY: Record<string, string> = {
  UAE: "AED 8,000-25,000/mo", "Saudi Arabia": "SAR 10,000-35,000/mo", Qatar: "QAR 12,000-30,000/mo",
  UK: "£28,000-55,000/yr", Canada: "CAD 55,000-95,000/yr", Australia: "AUD 70,000-120,000/yr",
  Singapore: "SGD 4,500-12,000/mo", Germany: "€45,000-85,000/yr", Malaysia: "MYR 6,000-15,000/mo",
  France: "€40,000-75,000/yr", Netherlands: "€42,000-80,000/yr", Ireland: "€45,000-90,000/yr",
  Oman: "OMR 800-2,500/mo", Kuwait: "KWD 900-2,800/mo", Bahrain: "BHD 900-2,400/mo",
  "New Zealand": "NZD 65,000-110,000/yr",
}

function buildAbroadJob(globalIdx: number, country: string, status: JobStatus): AbroadJob {
  const employers = ABROAD_EMPLOYERS[country] || ["Global Corp"]
  const company = pick(employers, globalIdx)
  const role = pick(ABROAD_ROLES, globalIdx)
  const prefix = status === "ARCHIVED_JOB" ? "arch-abroad" : status === "LIVE_JOB" ? "live-abroad" : "ver-abroad"
  return {
    id: `${prefix}-${country.toLowerCase().replace(/\s+/g, "-")}-${globalIdx + 1}`,
    title: `${role} — ${country}`,
    company,
    logo: company.slice(0, 2).toUpperCase(),
    country,
    location: `${country} — Major City`,
    type: "Full Time",
    salary: ABROAD_SALARY[country] || "Competitive",
    experience: pick(EXP_LEVELS, globalIdx),
    category: pick(ABROAD_CATS, globalIdx),
    description: `${role} opportunity with ${company} in ${country}.`,
    apply_url: status === "ARCHIVED_JOB" ? "#" : "https://careers.example.com/abroad",
    skills: ["Communication", "English"],
    badge: status === "ARCHIVED_JOB" ? "Archived" : syntheticOpenLabel(`${prefix}-${country.toLowerCase().replace(/\s+/g, "-")}-${globalIdx + 1}`),
    status: "active",
    posted_at: new Date(Date.now() - (globalIdx % 20) * 86400000).toISOString(),
    jobStatus: status,
    // Generated demo inventory — never a real opening (see provenance.ts).
    provenance: "SYNTHETIC",
  }
}

function generateAbroadInventory(): AbroadJob[] {
  const jobs: AbroadJob[] = []
  let g = 0
  let liveLeft = ABROAD_TARGETS.live
  let verLeft = ABROAD_TARGETS.verified
  for (const { country, count } of ABROAD_COUNTRY_TARGETS) {
    const liveSlot = Math.min(count, Math.max(1, Math.round((count / 5000) * ABROAD_TARGETS.live)))
    const verSlot = Math.min(count - liveSlot, verLeft > 0 ? 1 : 0)
    let liveAdded = 0
    let verAdded = 0
    for (let i = 0; i < count; i++, g++) {
      let status: JobStatus = "ARCHIVED_JOB"
      if (liveAdded < liveSlot && liveLeft > 0) { status = "LIVE_JOB"; liveAdded++; liveLeft-- }
      else if (verAdded < verSlot && verLeft > 0) { status = "VERIFIED_JOB"; verAdded++; verLeft-- }
      jobs.push(buildAbroadJob(g, country, status))
    }
  }
  return jobs
}

// ── Memoised inventories ──────────────────────────────────────────────
export const PRIVATE_INVENTORY: Job[] = generatePrivateInventory()
export const WFH_INVENTORY: WfhJob[] = generateWfhInventory()
export const ABROAD_INVENTORY: AbroadJob[] = generateAbroadInventory()

export { sortByStatus, countByStatus, paginate, type PaginatedResult } from "./inventoryPagination"

export function getPrivateInventoryCounts() {
  return countByStatus(PRIVATE_INVENTORY)
}

export function getWfhInventoryCounts() {
  return countByStatus(WFH_INVENTORY)
}

export function getAbroadInventoryCounts() {
  return countByStatus(ABROAD_INVENTORY)
}

/** Actual per-country counts from inventory (for country cards). */
export function getAbroadCountryCounts() {
  const map = new Map<string, number>()
  for (const j of ABROAD_INVENTORY) {
    map.set(j.country, (map.get(j.country) || 0) + 1)
  }
  return ABROAD_COUNTRY_TARGETS.map(c => ({
    name: c.country,
    flag: c.flag,
    jobs: map.get(c.country) || c.count,
    desc: c.desc,
  }))
}

/**
 * CATALOG totals (private + wfh + abroad) — the full browsable inventory,
 * including generated demo content. These are a "roles to explore" figure and
 * MUST NOT be presented as a count of genuine/live/verified opportunities.
 * For truthful trust counters use {@link getGenuineTotals}.
 */
export function getMarketplaceTotals() {
  const p = getPrivateInventoryCounts()
  const w = getWfhInventoryCounts()
  const a = getAbroadInventoryCounts()
  return {
    opportunities: p.all + w.all + a.all,
    liveJobs: p.live + w.live + a.live,
    verifiedJobs: p.verified + w.verified + a.verified,
    archivedJobs: p.archived + w.archived + a.archived,
    private: p,
    wfh: w,
    abroad: a,
  }
}

/**
 * GENUINE totals from the local inventory — only rows that pass the publication
 * gate (real provenance + real apply URL). With the current demo inventory this
 * is 0 by construction; real live/verified numbers come from the DB + external
 * APIs. Kept as a first-class helper so counters never silently pad trust
 * figures with synthetic content.
 */
export function getGenuineTotals() {
  const all = [...PRIVATE_INVENTORY, ...WFH_INVENTORY, ...ABROAD_INVENTORY]
  const genuine = all.filter(isCountableAsGenuine)
  const live = genuine.filter(isPublishableAsOpen).length
  return { opportunities: genuine.length, liveJobs: live }
}

export function getInventoryCounts() {
  return countByStatus([...PRIVATE_INVENTORY, ...WFH_INVENTORY, ...ABROAD_INVENTORY])
}
