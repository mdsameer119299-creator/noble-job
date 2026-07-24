/**
 * jobCategories.ts
 *
 * All job category options used across the site.
 * Matches the dropdown options in: Private Jobs filter, WFH filter,
 * Employer post job form, Candidate register form.
 */

export const JOB_CATEGORIES = [
  'IT',
  'Software',
  'Sales',
  'Marketing',
  'HR',
  'Finance',
  'Customer Support',
  'Operations',
  'Logistics',
  'Healthcare',
  'Education',
  'Manufacturing',
  'IT / Software',
  'Data / Analytics',
  'Product Management',
  'Design / Creative',
  'Sales / Marketing',
  'Finance / Accounts',
  'Customer Support',
  'Engineering',
  'Banking / Finance',
  'Operations',
  'Logistics / Delivery',
  'Teaching / Education',
  'HR / Recruitment',
  'Content Writing',
  'DevOps / Cloud',
  'Cybersecurity',
  'Healthcare',
  'Retail / Sales',
  'Consulting',
  'Legal / Compliance',
  'Driver',
  'Delivery Boy',
  'Security Guard',
  'Housekeeping',
  'Helper',
  'Electrician',
  'Plumber',
  'Shop Assistant',
  'Office Boy',
  'Receptionist',
  'Cook',
  'Maid',
  'Warehouse Staff',
] as const

export const WFH_CATEGORIES = [
  'IT / Software',
  'Content Writing',
  'Customer Support',
  'Data Entry',
  'Design & Creative',
  'Finance / Accounts',
  'HR / Recruitment',
  'Healthcare',
  'Sales & Marketing',
  'Teaching / Tutoring',
] as const

export const EXPERIENCE_LEVELS = [
  { label: 'Fresher',      value: 'fresher',    years: '0 years'  },
  { label: '0 – 1 Years',  value: '0-1',        years: '0-1'      },
  { label: '1 – 3 Years',  value: '1-3',        years: '1-3'      },
  { label: '3 – 5 Years',  value: '3-5',        years: '3-5'      },
  { label: '5 – 8 Years',  value: '5-8',        years: '5-8'      },
  { label: '8+ Years',     value: '8+',         years: '8+'       },
] as const

export const JOB_TYPES = [
  'Full Time', 'Part Time', 'Contract', 'Internship', 'Remote', 'Freelance',
] as const

export const LOCATION_FILTERS = [
  'All Locations', 'Remote', 'Delhi NCR', 'Bangalore', 'Mumbai', 'Hyderabad',
  'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Noida', 'Gurgaon',
] as const

export const SALARY_RANGES = [
  { label: 'Any Salary',       value: 'any'   },
  { label: '₹ 0 – 3 Lakhs',   value: '0-3'   },
  { label: '₹ 3 – 6 Lakhs',   value: '3-6'   },
  { label: '₹ 6 – 10 Lakhs',  value: '6-10'  },
  { label: '₹ 10 – 15 Lakhs', value: '10-15' },
  { label: '₹ 15 Lakhs+',     value: '15+'   },
] as const
