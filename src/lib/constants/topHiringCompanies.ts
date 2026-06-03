/** Top employers shown on WFH sidebar — logo initials + brand colors */
export interface TopHiringCompany {
  name: string
  abbr: string
  color: string
}

export const TOP_HIRING_WFH_COMPANIES: TopHiringCompany[] = [
  { name: 'Tech Mahindra', abbr: 'TM', color: '#1847d4' },
  { name: 'Genpact', abbr: 'GP', color: '#059669' },
  { name: 'Infosys', abbr: 'IN', color: '#f59e0b' },
  { name: 'Amazon', abbr: 'AM', color: '#f97316' },
  { name: 'Deloitte', abbr: 'DE', color: '#0d9488' },
  { name: 'Wipro', abbr: 'WI', color: '#8b5cf6' },
]
