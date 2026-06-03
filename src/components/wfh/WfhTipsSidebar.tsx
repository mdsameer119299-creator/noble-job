const TIPS = [
  'Set up a dedicated workspace',
  'Maintain fixed working hours',
  'Use time-tracking apps',
  'Join virtual team meetings on time',
  'Ensure stable internet connection',
  'Communicate proactively with your team',
]

export function WfhTipsSidebar() {
  return (
    <div className="wfh-widget">
      <h3 className="wfh-widget__title">💡 WFH Success Tips</h3>
      <ol className="wfh-widget__list">
        {TIPS.map(t => (
          <li key={t}>{t}</li>
        ))}
      </ol>
    </div>
  )
}
