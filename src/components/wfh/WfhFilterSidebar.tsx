'use client'

const EXP_OPTS = [
  { l: 'All Experience', v: 'all' },
  { l: 'Fresher', v: 'fresher' },
  { l: '0-2 Years', v: '0-2' },
  { l: '2-5 Years', v: '2-5' },
  { l: '5+ Years', v: '5+' },
]

const SORT_OPTS = [
  { l: 'Latest First', v: 'latest' },
  { l: 'Most Applied', v: 'applicants' },
]

interface WfhFilterSidebarProps {
  exp: string
  sort: string
  onExp: (v: string) => void
  onSort: (v: string) => void
}

export function WfhFilterSidebar({ exp, sort, onExp, onSort }: WfhFilterSidebarProps) {
  return (
    <aside className="wfh-filters">
      <div className="wfh-filters__card">
        <h3 className="wfh-filters__title">Filters</h3>

        <div style={{ marginBottom: 24 }}>
          <h4 className="wfh-filters__section-title">Experience</h4>
          {EXP_OPTS.map(o => (
            <label key={o.v} className="wfh-filters__option">
              <input type="radio" name="exp" checked={exp === o.v} onChange={() => onExp(o.v)} />
              <span>{o.l}</span>
            </label>
          ))}
        </div>

        <div>
          <h4 className="wfh-filters__section-title">Sort By</h4>
          {SORT_OPTS.map(o => (
            <label key={o.v} className="wfh-filters__option">
              <input type="radio" name="sort" checked={sort === o.v} onChange={() => onSort(o.v)} />
              <span>{o.l}</span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  )
}
