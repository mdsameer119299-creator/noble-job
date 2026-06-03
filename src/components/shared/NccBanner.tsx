// NccBanner — "A Livelihood Initiative by NCC FOUNDATION · Building India's Workforce"
// Exact replica of original class="ncc-banner" topbar
export function NccBanner() {
  return (
    <div
      className="w-full text-center py-2 text-xs font-semibold tracking-wide"
      style={{ background: 'linear-gradient(135deg,#1847d4,#060e28)', color: '#e0e8ff' }}
    >
      🏛 A Livelihood Initiative by{' '}
      <strong className="text-yellow-300 font-black">NCC FOUNDATION</strong>
      {' '}·{' '}Building India&apos;s Workforce
    </div>
  )
}
