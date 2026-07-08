/**
 * Shown in place of an "Apply" action on a synthetic/demo (non-genuine) job
 * detail page. Demo listings populate the catalog for browsing but are never a
 * live vacancy, so we must not present a real application call-to-action.
 */
export function SampleListingNotice() {
  return (
    <div
      role="note"
      style={{
        background: '#f8fafc',
        border: '1.5px dashed #cbd5e1',
        borderRadius: 12,
        padding: '16px 18px',
        color: '#475569',
        fontSize: 13.5,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 800, color: '#334155', marginBottom: 4 }}>
        🧪 Sample listing
      </div>
      This is a demonstration listing used to showcase how roles appear on Noble
      Job. It is <strong>not a live vacancy</strong> and cannot be applied to.
      Browse{' '}
      <a href="/jobs/govt" style={{ color: '#1847d4', fontWeight: 700 }}>
        Government Jobs
      </a>{' '}
      or set a{' '}
      <a href="/candidate/alerts" style={{ color: '#1847d4', fontWeight: 700 }}>
        Job Alert
      </a>{' '}
      to hear about genuine openings.
    </div>
  )
}
