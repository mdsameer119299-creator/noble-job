'use client'

export function PrintJobButton() {
  return (
    <button type="button" onClick={() => window.print()} title="Print job" style={btn}>
      🖨️ Print
    </button>
  )
}

const btn: React.CSSProperties = { background: 'transparent', border: '1.5px solid #e2e8f0', color: '#6b7280', padding: '7px 12px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }
