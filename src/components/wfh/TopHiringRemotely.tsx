import { TOP_HIRING_WFH_COMPANIES } from '@/lib/constants/topHiringCompanies'

export function TopHiringRemotely() {
  return (
    <div className="wfh-top-hiring">
      <h3 className="wfh-top-hiring__title">Top Hiring Companies</h3>
      <div className="wfh-top-hiring__list">
        {TOP_HIRING_WFH_COMPANIES.map(co => (
          <div key={co.name} className="wfh-top-hiring__company">
            <div className="wfh-top-hiring__logo" style={{ background: co.color }} aria-hidden>
              {co.abbr}
            </div>
            <div className="wfh-top-hiring__info">
              <p className="wfh-top-hiring__name">{co.name}</p>
              {/* The "Hiring Now" / "Verified Employer" badges were removed: this is a static
                  list of well-known company names, not evidence that any of them has an
                  open role or has been verified by Noble Job. */}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
