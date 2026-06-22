/**
 * govtStateContent.ts — unique, SEO-focused editorial content for every
 * /jobs/govt/state/[slug] page.
 *
 * Each state/UT carries its REAL recruiting authorities (PSC, subordinate staff
 * board, police board, a flagship university, the health/medical recruiter).
 * Intro paragraphs and FAQs are generated from these facts, so every state page
 * is genuinely unique (no boilerplate duplication) and targets high-intent
 * long-tail queries ("HPSC vacancy 2026", "UP Police constable recruitment").
 *
 * Add a STATE_BODY entry to enrich a region; STATE_DEFAULTS covers any gaps so
 * all 36 pages always render full content. Pure data — no DB / runtime deps.
 */
import { getStateBySlug } from "@/lib/config/govtTaxonomy"

export interface StateBodies {
  /** State Public Service Commission, full name + acronym. */
  psc: string
  /** Subordinate / staff selection board. */
  staffBoard: string
  /** Police recruitment authority. */
  police: string
  /** A flagship state/central university used as a recruiter example. */
  university: string
  /** Health / medical-services recruiter. */
  health: string
  /** 3–5 notable departments / exams for the chips + copy. */
  highlights: string[]
}

/** Real recruiting authorities by state/UT slug. */
export const STATE_BODIES: Record<string, StateBodies> = {
  "andhra-pradesh": { psc: "Andhra Pradesh Public Service Commission (APPSC)", staffBoard: "AP Grama/Ward Sachivalayam & subordinate boards", police: "AP State Level Police Recruitment Board (SLPRB)", university: "Andhra University", health: "Dr. YSR University of Health Sciences", highlights: ["APPSC Group I–IV", "AP Police Constable & SI", "AP Panchayat Secretary", "AP Health Dept"] },
  "arunachal-pradesh": { psc: "Arunachal Pradesh Public Service Commission (APPSC)", staffBoard: "Arunachal Pradesh Staff Selection Board (APSSB)", police: "Arunachal Pradesh Police", university: "Rajiv Gandhi University", health: "Department of Health & Family Welfare, Arunachal Pradesh", highlights: ["APPSC CCE", "APSSB CGL & MTS", "Arunachal Police", "Forest Dept"] },
  "assam": { psc: "Assam Public Service Commission (APSC)", staffBoard: "State Level Recruitment Commission, Assam (SLRC/ADRE)", police: "State Level Police Recruitment Board, Assam", university: "Gauhati University", health: "Directorate of Health Services, Assam", highlights: ["APSC CCE", "Assam Direct Recruitment (ADRE)", "Assam Police", "DME Assam"] },
  "bihar": { psc: "Bihar Public Service Commission (BPSC)", staffBoard: "Bihar Staff Selection Commission (BSSC)", police: "Central Selection Board of Constable (CSBC), Bihar", university: "Patna University", health: "State Health Society, Bihar", highlights: ["BPSC 70th CCE", "BPSC TRE Teacher", "Bihar Police CSBC", "BSSC Inter Level"] },
  "chhattisgarh": { psc: "Chhattisgarh Public Service Commission (CGPSC)", staffBoard: "Chhattisgarh Vyapam (CG Professional Examination Board)", police: "Chhattisgarh Police", university: "Pt. Ravishankar Shukla University", health: "Directorate of Health Services, Chhattisgarh", highlights: ["CGPSC State Service", "CG Vyapam", "Chhattisgarh Police", "CG Patwari"] },
  "goa": { psc: "Goa Public Service Commission (GPSC)", staffBoard: "Goa Staff Selection Commission", police: "Goa Police", university: "Goa University", health: "Directorate of Health Services, Goa", highlights: ["GPSC", "Goa SSC", "Goa Police", "Goa Health Dept"] },
  "gujarat": { psc: "Gujarat Public Service Commission (GPSC)", staffBoard: "Gujarat Subordinate Service Selection Board (GSSSB)", police: "Lokrakshak Recruitment Board (LRB), Gujarat", university: "Gujarat University", health: "Commissionerate of Health, Gujarat", highlights: ["GPSC Class 1-2", "GSSSB Bin Sachivalay", "Gujarat Police LRB", "GPSSB"] },
  "haryana": { psc: "Haryana Public Service Commission (HPSC)", staffBoard: "Haryana Staff Selection Commission (HSSC)", police: "Haryana Police", university: "Kurukshetra University", health: "Director General Health Services, Haryana", highlights: ["HPSC HCS", "HSSC CET Group C & D", "Haryana Police Constable", "Haryana Health Dept"] },
  "himachal-pradesh": { psc: "Himachal Pradesh Public Service Commission (HPPSC)", staffBoard: "Himachal Pradesh Staff Selection Commission (HPSSC, Hamirpur)", police: "Himachal Pradesh Police", university: "Himachal Pradesh University", health: "Directorate of Health Services, Himachal Pradesh", highlights: ["HPPSC HPAS", "HPSSC Hamirpur", "HP Police Constable", "HP Health"] },
  "jharkhand": { psc: "Jharkhand Public Service Commission (JPSC)", staffBoard: "Jharkhand Staff Selection Commission (JSSC)", police: "Jharkhand Police", university: "Ranchi University", health: "National Health Mission, Jharkhand", highlights: ["JPSC Civil Services", "JSSC CGL", "Jharkhand Police", "JSSC Excise Constable"] },
  "karnataka": { psc: "Karnataka Public Service Commission (KPSC)", staffBoard: "Karnataka Examinations Authority (KEA)", police: "Karnataka State Police", university: "Bangalore University", health: "Department of Health & Family Welfare Services, Karnataka", highlights: ["KPSC KAS", "KEA Group C", "Karnataka Police PC & PSI", "KPSC FDA/SDA"] },
  "kerala": { psc: "Kerala Public Service Commission (KPSC)", staffBoard: "Kerala PSC (departmental & last grade)", police: "Kerala Police", university: "University of Kerala", health: "Directorate of Health Services, Kerala", highlights: ["Kerala PSC LDC", "Kerala PSC LGS", "Kerala Police Constable", "Kerala Health Services"] },
  "madhya-pradesh": { psc: "Madhya Pradesh Public Service Commission (MPPSC)", staffBoard: "MP Employees Selection Board (MPESB / erstwhile Vyapam)", police: "Madhya Pradesh Police", university: "Barkatullah University", health: "Directorate of Health Services, Madhya Pradesh", highlights: ["MPPSC State Service", "MPESB Group 2-4", "MP Police Constable", "MP Patwari"] },
  "maharashtra": { psc: "Maharashtra Public Service Commission (MPSC)", staffBoard: "Maharashtra IBPS/TCS-based Group C boards", police: "Maharashtra Police", university: "University of Mumbai", health: "Directorate of Health Services, Maharashtra (Arogya Vibhag)", highlights: ["MPSC Rajyaseva", "MPSC Group B & C", "Maharashtra Police Bharti", "Arogya Vibhag (ZP Health)"] },
  "manipur": { psc: "Manipur Public Service Commission (MPSC)", staffBoard: "Manipur Staff Selection Board", police: "Manipur Police", university: "Manipur University", health: "Directorate of Health Services, Manipur", highlights: ["Manipur PSC MCSCC", "Manipur Police", "Manipur Health Dept"] },
  "meghalaya": { psc: "Meghalaya Public Service Commission (MPSC)", staffBoard: "Directorate of Manpower Planning, Meghalaya", police: "Meghalaya Police", university: "North-Eastern Hill University (NEHU)", health: "Directorate of Health Services, Meghalaya", highlights: ["Meghalaya PSC", "Meghalaya Police", "Meghalaya Health Dept"] },
  "mizoram": { psc: "Mizoram Public Service Commission (MPSC)", staffBoard: "District Selection Committees, Mizoram", police: "Mizoram Police", university: "Mizoram University", health: "Directorate of Health Services, Mizoram", highlights: ["Mizoram PSC MCSCC", "Mizoram Police", "Mizoram Health"] },
  "nagaland": { psc: "Nagaland Public Service Commission (NPSC)", staffBoard: "Nagaland Staff Selection Board", police: "Nagaland Police", university: "Nagaland University", health: "Directorate of Health & Family Welfare, Nagaland", highlights: ["NPSC CCE", "Nagaland Police", "Nagaland Health Dept"] },
  "odisha": { psc: "Odisha Public Service Commission (OPSC)", staffBoard: "Odisha Staff Selection Commission (OSSC)", police: "Odisha Police", university: "Utkal University", health: "Directorate of Health Services, Odisha", highlights: ["OPSC OAS", "OSSC CGL", "Odisha Police Constable & SI", "OSSSC"] },
  "punjab": { psc: "Punjab Public Service Commission (PPSC)", staffBoard: "Punjab Subordinate Services Selection Board (PSSSB)", police: "Punjab Police", university: "Panjab University", health: "Department of Health & Family Welfare, Punjab", highlights: ["PPSC", "PSSSB Clerk", "Punjab Police Constable", "Baba Farid Health University"] },
  "rajasthan": { psc: "Rajasthan Public Service Commission (RPSC)", staffBoard: "Rajasthan Staff Selection Board (RSMSSB / RSSB)", police: "Rajasthan Police", university: "University of Rajasthan", health: "Directorate of Medical & Health Services, Rajasthan", highlights: ["RPSC RAS", "RSMSSB CET", "Rajasthan Police Constable", "RPSC Senior Teacher"] },
  "sikkim": { psc: "Sikkim Public Service Commission (SPSC)", staffBoard: "Sikkim SSC / departmental boards", police: "Sikkim Police", university: "Sikkim University", health: "Health Care, Human Services & Family Welfare Dept, Sikkim", highlights: ["Sikkim PSC", "Sikkim Police", "Sikkim Health Dept"] },
  "tamil-nadu": { psc: "Tamil Nadu Public Service Commission (TNPSC)", staffBoard: "Teachers Recruitment Board (TRB) & TN MRB", police: "Tamil Nadu Uniformed Services Recruitment Board (TNUSRB)", university: "University of Madras", health: "TN Medical Services Recruitment Board (MRB)", highlights: ["TNPSC Group I–IV", "TNUSRB Police Constable", "TN MRB Nurse & Pharmacist", "TRB Teacher"] },
  "telangana": { psc: "Telangana Public Service Commission (TGPSC/TSPSC)", staffBoard: "TG Gurukulam & subordinate boards", police: "Telangana State Level Police Recruitment Board (TSLPRB)", university: "Osmania University", health: "Director of Public Health, Telangana", highlights: ["TGPSC Group I–IV", "Telangana Police Constable & SI", "TS Gurukulam", "TS Health Dept"] },
  "tripura": { psc: "Tripura Public Service Commission (TPSC)", staffBoard: "Tripura Staff Selection (JRBT)", police: "Tripura Police", university: "Tripura University", health: "Directorate of Health Services, Tripura", highlights: ["TPSC", "JRBT Group C & D", "Tripura Police", "Tripura Health"] },
  "uttar-pradesh": { psc: "Uttar Pradesh Public Service Commission (UPPSC)", staffBoard: "UP Subordinate Services Selection Commission (UPSSSC)", police: "UP Police Recruitment & Promotion Board (UPPRPB)", university: "University of Lucknow", health: "UP National Health Mission / Medical & Health Dept", highlights: ["UPPSC PCS", "UPSSSC PET & Lekhpal", "UP Police Constable & SI", "UP Health (NHM)"] },
  "uttarakhand": { psc: "Uttarakhand Public Service Commission (UKPSC)", staffBoard: "Uttarakhand Subordinate Service Selection Commission (UKSSSC)", police: "Uttarakhand Police", university: "Kumaun University", health: "Directorate of Medical Health, Uttarakhand", highlights: ["UKPSC PCS", "UKSSSC Group C", "Uttarakhand Police Constable", "UK Health Dept"] },
  "west-bengal": { psc: "West Bengal Public Service Commission (WBPSC)", staffBoard: "West Bengal SSC & PSC Misc.", police: "West Bengal Police Recruitment Board", university: "University of Calcutta", health: "West Bengal Health Recruitment Board (WBHRB)", highlights: ["WBPSC WBCS", "WBPSC Clerkship", "WB Police Constable & SI", "WBHRB Staff Nurse"] },
  // Union Territories
  "andaman-and-nicobar-islands": { psc: "Andaman & Nicobar Administration (UPSC/SSC channels)", staffBoard: "A&N Administration recruitment cells", police: "Andaman & Nicobar Police", university: "Pondicherry University (A&N campus)", health: "Directorate of Health Services, A&N Islands", highlights: ["A&N Administration", "A&N Police", "A&N Health Dept"] },
  "chandigarh": { psc: "Chandigarh Administration (UPSC/SSC channels)", staffBoard: "Chandigarh Administration recruitment cells", police: "Chandigarh Police", university: "Panjab University", health: "Department of Health, Chandigarh (GMCH/GMSH)", highlights: ["Chandigarh Administration", "Chandigarh Police", "GMCH-32"] },
  "dadra-and-nagar-haveli-and-daman-and-diu": { psc: "DNH & DD Administration (UPSC/SSC channels)", staffBoard: "UT Administration recruitment cells", police: "DNH & DD Police", university: "Government colleges, DNH & DD", health: "Directorate of Medical & Health Services, DNH & DD", highlights: ["UT Administration", "DNH & DD Police", "UT Health Dept"] },
  "delhi": { psc: "Delhi Subordinate Services Selection Board (DSSSB)", staffBoard: "Delhi Subordinate Services Selection Board (DSSSB)", police: "Delhi Police (via SSC)", university: "University of Delhi", health: "Department of Health & Family Welfare, GNCTD", highlights: ["DSSSB", "Delhi Police Constable (SSC GD)", "DU non-teaching", "Delhi Health Dept"] },
  "jammu-and-kashmir": { psc: "Jammu & Kashmir Public Service Commission (JKPSC)", staffBoard: "J&K Services Selection Board (JKSSB)", police: "Jammu & Kashmir Police", university: "University of Kashmir", health: "Directorate of Health Services, J&K", highlights: ["JKPSC KAS", "JKSSB", "J&K Police Constable & SI", "J&K Health"] },
  "ladakh": { psc: "Ladakh Autonomous Administration (UPSC/SSC channels)", staffBoard: "UT Ladakh recruitment cells", police: "Ladakh Police", university: "University of Ladakh", health: "Directorate of Health Services, Ladakh", highlights: ["UT Ladakh", "Ladakh Police", "Ladakh Health Dept"] },
  "lakshadweep": { psc: "Lakshadweep Administration (UPSC/SSC channels)", staffBoard: "UT Administration recruitment cells", police: "Lakshadweep Police", university: "Government institutions, Lakshadweep", health: "Directorate of Health Services, Lakshadweep", highlights: ["UT Administration", "Lakshadweep Police", "UT Health Dept"] },
  "puducherry": { psc: "Puducherry Public Service Commission", staffBoard: "Puducherry recruitment boards", police: "Puducherry Police", university: "Pondicherry University", health: "Directorate of Health & Family Welfare, Puducherry", highlights: ["Puducherry PSC", "Puducherry Police", "JIPMER", "Puducherry Health"] },
}

const STATE_DEFAULTS: StateBodies = {
  psc: "the State Public Service Commission",
  staffBoard: "the State Staff Selection Board",
  police: "the State Police recruitment board",
  university: "the state universities",
  health: "the State Health Department",
  highlights: ["State PSC", "State Police", "State Health Dept", "State Universities"],
}

export function getStateBodies(slug: string): StateBodies {
  return STATE_BODIES[slug] ?? STATE_DEFAULTS
}

export interface StateIntro {
  /** 2–3 unique paragraphs for the on-page intro block. */
  paragraphs: string[]
  /** Recruiter chips. */
  chips: string[]
  /** Unique FAQ set for FAQPage schema + accordion. */
  faqs: { question: string; answer: string }[]
}

/**
 * Build unique intro + FAQ content for a state. `notifications` is the live
 * count (state-own where available, else national pool) so the copy stays
 * truthful whether or not the state currently has its own recruitments.
 */
export function getStateIntro(slug: string, opts?: { notifications?: number; usedNationalFallback?: boolean }): StateIntro {
  const region = getStateBySlug(slug)
  const label = region?.label.replace(/\s*\(.*\)$/, "") ?? "the state"
  const b = getStateBodies(slug)
  const n = opts?.notifications ?? 0
  const fallback = opts?.usedNationalFallback ?? false
  const year = 2026

  const countLine = n > 0
    ? `Noble Job is currently tracking ${n}+ live ${fallback ? "national" : `${label}`} government ${n === 1 ? "vacancy" : "vacancies"} relevant to ${label} candidates`
    : `Noble Job tracks every ${label} government recruitment as soon as it is notified`

  const paragraphs = [
    `${label} Government Jobs ${year}: ${countLine}. From ${b.psc} and ${b.staffBoard} to ${b.police}, this page brings together the latest sarkari naukri notifications, vacancy counts, eligibility, age limits, last dates and direct apply links for ${label} — updated automatically every day.`,
    `Major recruiters in ${label} include ${b.psc} for gazetted and administrative posts, ${b.staffBoard} for clerical and Group C/D cadres, and ${b.police} for constable and sub-inspector intakes. Teaching and non-teaching vacancies are published by ${b.university}, while ${b.health} hires doctors, staff nurses, pharmacists and paramedical staff across ${label}.`,
    fallback
      ? `While ${label} has no state-specific notification open at this moment, candidates from ${label} are fully eligible for the national (All-India) government jobs listed below — SSC, UPSC, banking (IBPS), railways (RRB) and central PSU recruitment. Bookmark this page: new ${label} PSC, police and departmental vacancies appear here the day they are announced.`
      : `Whether you are preparing for the ${b.highlights[0]} or a ${label} police recruitment, you can filter the listings below by qualification, department and last date. Set this page as a bookmark to never miss a ${label} sarkari job — every notification is verified and linked to its official source.`,
  ]

  const faqs = [
    {
      question: `What government jobs are available in ${label} in ${year}?`,
      answer: `${label} government jobs in ${year} include recruitment by ${b.psc}, ${b.staffBoard}, ${b.police}, ${b.university} and ${b.health}. Popular openings cover ${b.highlights.slice(0, 3).join(", ")} and various Group A, B, C and D posts.`,
    },
    {
      question: `Which is the main recruiting body for ${label} state government jobs?`,
      answer: `${b.psc} is the primary recruiter for gazetted and administrative posts in ${label}, while ${b.staffBoard} handles subordinate and clerical cadre recruitment. Police vacancies are released by ${b.police}.`,
    },
    {
      question: `How can I apply for ${label} government jobs online?`,
      answer: `Open the relevant notification on this ${label} government jobs page, check the eligibility and last date, then use the official apply-online link to register on the recruiting body's portal and submit your application before the deadline.`,
    },
    {
      question: `Can candidates from ${label} apply for All-India government jobs?`,
      answer: `Yes. ${label} candidates are eligible for all national government jobs — SSC, UPSC, IBPS banking, RRB railways, defence and central PSUs — in addition to ${label}-specific state recruitments. Both are listed on Noble Job.`,
    },
    {
      question: `How often are ${label} government job notifications updated?`,
      answer: `Noble Job updates ${label} sarkari naukri notifications every day through automated ingestion from official sources, so new ${b.psc} and ${b.police} vacancies appear here as soon as they are published.`,
    },
  ]

  return { paragraphs, chips: b.highlights, faqs }
}
