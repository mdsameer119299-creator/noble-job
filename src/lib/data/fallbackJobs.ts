/**
 * Fallback / demo vacancy data used when Supabase is not configured, and as the
 * seed for the generated showcase inventory. These are hand-authored SAMPLE
 * listings (they link to companies' generic careers pages, not to a specific
 * open requisition), so private/WFH/abroad rows here are stamped
 * `provenance: 'SYNTHETIC'` and must never be presented as genuine, verified,
 * indexable, or schema-bearing openings. Government fallback rows mirror real
 * ingested notifications and remain genuine. See src/lib/jobs/provenance.ts.
 */
import type { GovtJob, GovtJobTab } from '@/types/govtJob'
import { isGovtJobExpired } from '@/lib/utils/govtJobExpiry'
import type { WfhJob } from '@/types/wfhJob'
import type { AbroadJob } from '@/types/abroadJob'
import type { Job } from '@/types/job'

/** UI components use snake_case date/age fields from DB */
type GovtJobRow = GovtJob & { last_date: string; age_range: string }

export const FALLBACK_GOVT_JOBS: GovtJobRow[] = [
  { id: 'sbi-apprentice-2026', title: 'SBI Apprentice Recruitment 2026', org: 'State Bank of India', short: 'SBI', post: 'Apprentice', vacancies: '7150', qualification: 'Graduation', ageRange: '20-28 Years', age_range: '20-28 Years', fee: '300', lastDate: '30 Jun 2026', last_date: '30 Jun 2026', salary: '15,000/mo', location: 'All India', state: 'All India', tab: 'latest', color: '#1e3a8a', badge: 'New', status: 'active' },
  { id: 'iaf-afcat-02-2026', title: 'IAF AFCAT 02 2026 Notification', org: 'Indian Air Force', short: 'IAF', post: 'Flying/Ground Duty Officer', vacancies: '379', qualification: 'Graduation (60%)', ageRange: '20-26 Years', age_range: '20-26 Years', fee: '250', lastDate: '15 Jun 2026', last_date: '15 Jun 2026', salary: '56,100-1,77,500/mo', location: 'All India', state: 'All India', tab: 'latest', color: '#1d4ed8', badge: 'Hot', status: 'active' },
  { id: 'crpf-constable-2026', title: 'CRPF Constable Tradesman 2026', org: 'CRPF', short: 'CRPF', post: 'Constable (Tradesman)', vacancies: '9195', qualification: '10th / ITI', ageRange: '18-23 Years', age_range: '18-23 Years', fee: '100', lastDate: '30 Jun 2026', last_date: '30 Jun 2026', salary: '21,700-69,100/mo', location: 'All India', state: 'All India', tab: 'latest', color: '#7c3aed', badge: 'Hot', status: 'active' },
  { id: 'bob-credit-officer-2026', title: 'Bank of Baroda Credit Officer 2026', org: 'Bank of Baroda', short: 'BOB', post: 'Credit Officer', vacancies: '5000', qualification: 'Graduation', ageRange: '25-35 Years', age_range: '25-35 Years', fee: '600', lastDate: '20 Jun 2026', last_date: '20 Jun 2026', salary: '48,170-69,810/mo', location: 'All India', state: 'All India', tab: 'latest', color: '#b45309', badge: 'New', status: 'active' },
  { id: 'ossc-je-2026', title: 'OSSC Junior Engineer 2026', org: 'Odisha SSC', short: 'OSSC', post: 'Junior Engineer (Civil/Elect/Mech)', vacancies: '646', qualification: 'B.Tech/Diploma', ageRange: '21-38 Years', age_range: '21-38 Years', fee: '0', lastDate: '25 Jun 2026', last_date: '25 Jun 2026', salary: '35,400-1,12,400/mo', location: 'Odisha', state: 'Odisha', tab: 'latest', color: '#0e7490', badge: 'New', status: 'active' },
  { id: 'cnp-nashik-2026', title: 'Currency Note Press Nashik 2026', org: 'CNP Nashik (SPMCIL)', short: 'CNP', post: 'Skilled Artisan / Technician', vacancies: '534', qualification: '10th / ITI', ageRange: '18-30 Years', age_range: '18-30 Years', fee: '100', lastDate: '18 Jun 2026', last_date: '18 Jun 2026', salary: '19,900-63,200/mo', location: 'Nashik, Maharashtra', state: 'Maharashtra', tab: 'latest', color: '#be123c', badge: 'New', status: 'active' },
  { id: 'secr-apprentice-2026', title: 'SECR Apprentice Recruitment 2026', org: 'South East Central Railway', short: 'SECR', post: 'Apprentice (Various Trades)', vacancies: '1079', qualification: '10th + ITI', ageRange: '15-24 Years', age_range: '15-24 Years', fee: '0', lastDate: '25 Jun 2026', last_date: '25 Jun 2026', salary: 'As per NATS norms', location: 'Bilaspur (CG)', state: 'Chhattisgarh', tab: 'latest', color: '#047857', badge: 'New', status: 'active' },
  { id: 'union-bank-credit-2026', title: 'Union Bank Credit Officer 2026', org: 'Union Bank of India', short: 'UBI', post: 'Credit Officer (Scale II/III)', vacancies: '1865', qualification: 'Graduation', ageRange: '25-35 Years', age_range: '25-35 Years', fee: '600', lastDate: '10 Jun 2026', last_date: '10 Jun 2026', salary: '48,170-85,920/mo', location: 'All India', state: 'All India', tab: 'latest', color: '#d97706', badge: 'New', status: 'active' },
  { id: 'upsc-cse-2026', title: 'UPSC Civil Services Exam 2026', org: 'UPSC', short: 'UPSC', post: 'IAS/IPS/IFS', vacancies: '1059', qualification: 'Graduation', ageRange: '21-32 Years', age_range: '21-32 Years', fee: '100', lastDate: 'TBA', last_date: 'TBA', salary: '56,100+', location: 'All India', state: 'All India', tab: 'upcoming', color: '#1e3a8a', badge: 'Upcoming', status: 'active' },
  { id: 'ssc-cgl-2026', title: 'SSC CGL 2026-27 Recruitment', org: 'SSC', short: 'SSC', post: 'Group B & C', vacancies: '17727', qualification: 'Graduation', ageRange: '18-32 Years', age_range: '18-32 Years', fee: '100', lastDate: 'TBA', last_date: 'TBA', salary: '25,500-1,51,100/mo', location: 'All India', state: 'All India', tab: 'upcoming', color: '#7c3aed', badge: 'Upcoming', status: 'active' },
  { id: 'ibps-po-xiv-result', title: 'IBPS PO XIV Final Result 2025', org: 'IBPS', short: 'IBPS', post: 'Probationary Officer', vacancies: '4455', qualification: 'Graduation', ageRange: '-', age_range: '-', fee: '-', lastDate: '-', last_date: '-', salary: '36,000-63,840/mo', location: 'All India', state: 'All India', tab: 'results', color: '#059669', badge: 'Result Out', status: 'active' },
  { id: 'ssc-chsl-result-2025', title: 'SSC CHSL 2024 Final Result', org: 'SSC', short: 'SSC', post: 'LDC/JSA/PA/SA', vacancies: '3713', qualification: '-', ageRange: '-', age_range: '-', fee: '-', lastDate: '-', last_date: '-', salary: '19,900-81,100/mo', location: 'All India', state: 'All India', tab: 'results', color: '#7c3aed', badge: 'Result Out', status: 'active' },
  { id: 'railway-ntpc-result', title: 'Railway NTPC Level 2-6 Result 2025', org: 'RRB', short: 'RRB', post: 'Non-Technical Graduate Posts', vacancies: '11558', qualification: '-', ageRange: '-', age_range: '-', fee: '-', lastDate: '-', last_date: '-', salary: '19,900-35,400/mo', location: 'All India', state: 'All India', tab: 'results', color: '#b45309', badge: 'Result Out', status: 'active' },
  { id: 'niacl-ao-result', title: 'NIACL Assistant Final Result 2025', org: 'NIACL', short: 'NIACL', post: 'Assistant', vacancies: '300', qualification: '-', ageRange: '-', age_range: '-', fee: '-', lastDate: '-', last_date: '-', salary: '14,435-52,000/mo', location: 'All India', state: 'All India', tab: 'results', color: '#0e7490', badge: 'Result Out', status: 'active' },
  { id: 'ibps-clerk-admit-2025', title: 'IBPS Clerk Prelims Admit Card 2025', org: 'IBPS', short: 'IBPS', post: 'Clerk', vacancies: '6128', qualification: '-', ageRange: '-', age_range: '-', fee: '-', lastDate: '31 Aug 2026', last_date: '31 Aug 2026', salary: '11,765-42,020/mo', location: 'All India', state: 'All India', tab: 'admit', color: '#1847d4', badge: 'Admit Out', status: 'active' },
  { id: 'ssc-gd-admit-2026', title: 'SSC GD Constable Admit Card 2026', org: 'SSC', short: 'SSC', post: 'Constable GD', vacancies: '39481', qualification: '-', ageRange: '-', age_range: '-', fee: '-', lastDate: '10 Jul 2026', last_date: '10 Jul 2026', salary: '21,700-69,100/mo', location: 'All India', state: 'All India', tab: 'admit', color: '#7c3aed', badge: 'Admit Out', status: 'active' },
  { id: 'navy-mr-admit-2026', title: 'Indian Navy MR Admit Card 2026', org: 'Indian Navy', short: 'NAVY', post: 'Matric Recruit', vacancies: '2500', qualification: '-', ageRange: '-', age_range: '-', fee: '-', lastDate: '05 Jul 2026', last_date: '05 Jul 2026', salary: '21,700+', location: 'All India', state: 'All India', tab: 'admit', color: '#0369a1', badge: 'Admit Out', status: 'active' },
  { id: 'ctet-answer-2025', title: 'CTET December 2025 Answer Key', org: 'CBSE', short: 'CBSE', post: 'Teacher Eligibility', vacancies: '35493', qualification: '-', ageRange: '-', age_range: '-', fee: '-', lastDate: '-', last_date: '-', salary: '-', location: 'All India', state: 'All India', tab: 'answer', color: '#059669', badge: 'Key Released', status: 'active' },
  { id: 'ibps-rrb-answer-2025', title: 'IBPS RRB PO/Clerk Answer Key 2025', org: 'IBPS', short: 'IBPS', post: 'RRB PO/Clerk', vacancies: '9606', qualification: '-', ageRange: '-', age_range: '-', fee: '-', lastDate: '-', last_date: '-', salary: '29,000-65,000/mo', location: 'All India', state: 'All India', tab: 'answer', color: '#1847d4', badge: 'Key Released', status: 'active' },
  { id: 'ssc-mts-answer-2025', title: 'SSC MTS Answer Key 2025', org: 'SSC', short: 'SSC', post: 'Multi-Tasking Staff', vacancies: '10880', qualification: '-', ageRange: '-', age_range: '-', fee: '-', lastDate: '-', last_date: '-', salary: '18,000-22,000/mo', location: 'All India', state: 'All India', tab: 'answer', color: '#7c3aed', badge: 'Key Released', status: 'active' },
]

/** Stage tabs map 1:1 to a job's `tab`; sector tabs are derived from org/keywords. */
const SECTOR_MATCHERS: Partial<Record<GovtJobTab, (j: GovtJobRow) => boolean>> = {
  railway: j => /rail|rrb|rrc|metro/i.test(`${j.org} ${j.title}`),
  banking: j => /bank|sbi|ibps|rbi|nabard/i.test(`${j.org} ${j.title}`),
  ssc: j => /\bssc\b/i.test(`${j.org} ${j.short}`),
  upsc: j => /\bupsc\b/i.test(`${j.org} ${j.short}`),
  state: j => j.state !== 'All India',
  psu: j => /ongc|ntpc|bhel|gail|sail|iocl|psu|coal india/i.test(`${j.org} ${j.title}`),
}

export function getFallbackGovtJobs(tab: GovtJobTab = 'latest', state?: string): GovtJobRow[] {
  const matcher = SECTOR_MATCHERS[tab]
  let list: GovtJobRow[]
  if (matcher) {
    list = FALLBACK_GOVT_JOBS.filter(matcher)
  } else if (tab === 'syllabus' || tab === 'scholarships') {
    // No seeded entries yet — populated automatically by the daily scheduler.
    list = []
  } else {
    list = FALLBACK_GOVT_JOBS.filter(j => j.tab === tab)
  }
  if (state && state !== 'All India') list = list.filter(j => j.state === state || j.location === state)
  // Remove jobs whose application window has closed. Both the status flag and
  // the actual lastDate are checked so stale seed entries are filtered even
  // before a cron run has had a chance to flip the status column.
  list = list.filter(j => j.status !== 'expired' && !isGovtJobExpired(j.lastDate))
  // Government openings are treated as live/verified; expired notices become archived.
  return list.map(j => ({
    ...j,
    jobStatus: j.jobStatus ?? (j.status === 'expired' ? 'ARCHIVED_JOB' : tab === 'latest' ? 'LIVE_JOB' : 'VERIFIED_JOB'),
  }))
}

export const FALLBACK_WFH_JOBS: WfhJob[] = [
  { id: 'wfh-1', title: 'React Developer - Remote India', company: 'TechMahindra', logo: 'TM', color: '#1847d4', type: 'Full Time Remote', experience: '2-4 Yrs', salary: '₹8-14 LPA', cat: 'IT / Software', qualification: 'B.Tech/MCA', skills: ['React', 'Node.js', 'JavaScript'], badge: 'Hot', badge_type: 'hot', applicants: 342, description: 'Remote React developer role.', apply_url: 'https://careers.techmahindra.com/', posted_at: new Date().toISOString(), status: 'active', provenance: 'SYNTHETIC' },
  { id: 'wfh-2', title: 'Content Writer (Remote)', company: 'Naukri', logo: 'NK', color: '#e11d48', type: 'Full Time Remote', experience: 'Fresher', salary: '₹3-5 LPA', cat: 'Content Writing', qualification: 'Graduate', skills: ['Content Writing', 'SEO'], badge: 'New', badge_type: 'new', applicants: 189, description: 'WFH content writer.', apply_url: 'https://www.naukri.com/', posted_at: new Date().toISOString(), status: 'active', provenance: 'SYNTHETIC' },
  { id: 'wfh-3', title: 'Data Entry Specialist', company: 'Genpact', logo: 'GP', color: '#7c3aed', type: 'Full Time Remote', experience: 'Fresher', salary: '₹2.5-4 LPA', cat: 'Data Entry', qualification: '12th Pass', skills: ['MS Excel', 'Data Entry'], badge: 'New', badge_type: 'new', applicants: 421, description: 'Remote data entry.', apply_url: 'https://careers.genpact.com/', posted_at: new Date().toISOString(), status: 'active', provenance: 'SYNTHETIC' },
  { id: 'wfh-4', title: 'Digital Marketing Executive', company: 'Flipkart', logo: 'FK', color: '#f59e0b', type: 'Full Time Remote', experience: '1-3 Yrs', salary: '₹5-9 LPA', cat: 'Sales & Marketing', qualification: 'Graduate', skills: ['Digital Marketing', 'SEO'], badge: 'Hot', badge_type: 'hot', applicants: 267, description: 'Remote marketing role.', apply_url: 'https://www.flipkartcareers.com/', posted_at: new Date().toISOString(), status: 'active', provenance: 'SYNTHETIC' },
  { id: 'wfh-5', title: 'Customer Associate (WFH)', company: 'Amazon', logo: 'AMZ', color: '#f97316', type: 'Full Time Remote', experience: 'Fresher', salary: '₹2.5-4 LPA', cat: 'Customer Support', qualification: 'Graduate', skills: ['Communication'], badge: 'New', badge_type: 'new', applicants: 1234, description: 'Amazon WFH support.', apply_url: 'https://www.amazon.jobs/', posted_at: new Date().toISOString(), status: 'active', provenance: 'SYNTHETIC' },
  { id: 'wfh-6', title: 'Tech Support Engineer (Remote)', company: 'Wipro', logo: 'WI', color: '#7c3aed', type: 'Full Time Remote', experience: '1-3 Yrs', salary: '₹4-7 LPA', cat: 'IT / Software', qualification: 'B.Tech', skills: ['Technical Support'], badge: 'New', badge_type: 'new', applicants: 298, description: 'Wipro remote support.', apply_url: 'https://careers.wipro.com/', posted_at: new Date().toISOString(), status: 'active', provenance: 'SYNTHETIC' },
]

export const FALLBACK_ABROAD_JOBS: AbroadJob[] = [
  { id: 'abroad-1', title: 'Cabin Crew', company: 'Emirates', logo: 'EK', country: 'UAE', location: 'Dubai, UAE', type: 'Full Time', salary: '$2,800-3,500/mo', experience: 'Fresher', category: 'Aviation', description: 'Emirates cabin crew.', apply_url: 'https://www.emiratesgroupcareers.com/', skills: ['Communication'], badge: 'New', status: 'active', posted_at: new Date().toISOString(), provenance: 'SYNTHETIC' },
  { id: 'abroad-2', title: 'Petroleum Engineer', company: 'Saudi Aramco', logo: 'SA', country: 'Saudi Arabia', location: 'Dhahran', type: 'Full Time', salary: '$8,000-15,000/mo', experience: '5-10 Yrs', category: 'Engineering', description: 'Aramco engineering role.', apply_url: 'https://www.aramcojobs.com/', skills: ['Petroleum Engineering'], badge: 'Hot', status: 'active', posted_at: new Date().toISOString(), provenance: 'SYNTHETIC' },
  { id: 'abroad-3', title: 'Nurse (ICU)', company: 'NHS UK', logo: 'NH', country: 'UK', location: 'London', type: 'Full Time', salary: '£32,000-45,000/yr', experience: '2+ Yrs', category: 'Healthcare', description: 'NHS ICU nurse.', apply_url: 'https://www.jobs.nhs.uk/', skills: ['ICU Care'], badge: 'Hot', status: 'active', posted_at: new Date().toISOString(), provenance: 'SYNTHETIC' },
  { id: 'abroad-4', title: 'Software Engineer', company: 'Google', logo: 'GGL', country: 'USA', location: 'New York', type: 'Full Time', salary: '$120,000-200,000/yr', experience: '3-6 Yrs', category: 'IT / Software', description: 'Google SWE.', apply_url: 'https://careers.google.com/', skills: ['Java', 'Python'], badge: 'Hot', status: 'active', posted_at: new Date().toISOString(), provenance: 'SYNTHETIC' },
  { id: 'abroad-5', title: 'Civil Engineer', company: 'AECOM', logo: 'AEC', country: 'UAE', location: 'Dubai', type: 'Full Time', salary: 'AED 15,000-25,000/mo', experience: '3-7 Yrs', category: 'Engineering', description: 'AECOM UAE projects.', apply_url: 'https://aecom.jobs/', skills: ['Civil Engineering'], badge: 'New', status: 'active', posted_at: new Date().toISOString(), provenance: 'SYNTHETIC' },
]

export const FALLBACK_PRIVATE_JOBS: Job[] = [
  { id: 'priv-1', title: 'Software Engineer', company: 'TCS', logo: 'TC', color: '#1847d4', location: 'Bangalore', type: 'Full Time', exp: '1-3 Years', salary: '₹6-12 LPA', cat: 'IT / Software', skills: ['Java', 'Python'], badge: 'Verified', applyUrl: 'https://ibegin.tcs.com/iBegin/', desc: 'TCS software engineer.', posted: '2 days ago', verified: true, source: 'TCS — Official', board: 'private', provenance: 'SYNTHETIC' },
  { id: 'priv-2', title: 'Systems Engineer', company: 'Infosys', logo: 'IN', color: '#f59e0b', location: 'Pune', type: 'Full Time', exp: 'Fresher', salary: '₹3.5-7 LPA', cat: 'IT / Software', skills: ['Java', 'DBMS'], badge: 'Verified', applyUrl: 'https://career.infosys.com/', desc: 'Infosys fresher role.', posted: '1 day ago', verified: true, source: 'Infosys', board: 'private', provenance: 'SYNTHETIC' },
  { id: 'priv-3', title: 'Project Engineer', company: 'Wipro', logo: 'WI', color: '#8b5cf6', location: 'Hyderabad', type: 'Full Time', exp: '0-2 Yrs', salary: '₹4-8 LPA', cat: 'IT / Software', skills: ['Java', 'Agile'], badge: 'Verified', applyUrl: 'https://careers.wipro.com/', desc: 'Wipro project engineer.', posted: '3 days ago', verified: true, source: 'Wipro', board: 'private', provenance: 'SYNTHETIC' },
  { id: 'priv-4', title: 'Software Development Engineer', company: 'Amazon', logo: 'AM', color: '#f97316', location: 'Bangalore', type: 'Full Time', exp: '2-6 Years', salary: '₹15-45 LPA', cat: 'IT / Software', skills: ['Java', 'AWS'], badge: 'Hot', applyUrl: 'https://www.amazon.jobs/', desc: 'Amazon SDE.', posted: '6 hours ago', verified: true, source: 'Amazon', board: 'private', provenance: 'SYNTHETIC' },
  { id: 'priv-5', title: 'Product Manager', company: 'Flipkart', logo: 'FK', color: '#ef4444', location: 'Bangalore', type: 'Full Time', exp: '3-6 Years', salary: '₹30-80 LPA', cat: 'Product', skills: ['Product Strategy'], badge: 'Hot', applyUrl: 'https://www.flipkartcareers.com/', desc: 'Flipkart PM.', posted: '3 days ago', verified: true, source: 'Flipkart', board: 'private', provenance: 'SYNTHETIC' },
  { id: 'priv-6', title: 'Member Technical Staff', company: 'Zoho', logo: 'ZO', color: '#1847d4', location: 'Chennai', type: 'Full Time', exp: '1-4 Years', salary: '₹6-14 LPA', cat: 'IT / Software', skills: ['Java', 'C++'], badge: 'Verified', applyUrl: 'https://www.zoho.com/careers.html', desc: 'Zoho MTS.', posted: '5 days ago', verified: true, source: 'Zoho', board: 'private', provenance: 'SYNTHETIC' },
  { id: 'priv-7', title: 'Relationship Manager', company: 'HDFC Bank', logo: 'HD', color: '#1e3a8a', location: 'Pan India', type: 'Full Time', exp: '1-4 Years', salary: '₹4-9 LPA', cat: 'Banking', skills: ['Sales'], badge: 'New', applyUrl: 'https://www.hdfcbank.com/careers', desc: 'HDFC RM.', posted: '2 days ago', verified: true, source: 'HDFC', board: 'private', provenance: 'SYNTHETIC' },
  { id: 'priv-8', title: 'Business Technology Analyst', company: 'Deloitte', logo: 'DE', color: '#0e7490', location: 'Mumbai', type: 'Full Time', exp: '0-2 Years', salary: '₹8-14 LPA', cat: 'Consulting', skills: ['Analytics'], badge: 'New', applyUrl: 'https://www2.deloitte.com/in/en/careers.html', desc: 'Deloitte BTA.', posted: '2 days ago', verified: true, source: 'Deloitte', board: 'private', provenance: 'SYNTHETIC' },
]
