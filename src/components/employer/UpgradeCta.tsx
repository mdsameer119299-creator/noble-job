interface Plan {
  key: string
  name: string
  price: string
  badge?: { label: string; color: string; bg: string }
  features: string[]
  cta: { label: string; href: string }
  highlight?: boolean
}

const PLANS: Plan[] = [
  {
    key: 'free',
    name: 'Free Plan',
    price: '₹0',
    features: ['Up to 3 active job postings', 'Standard candidate applications', 'Email support'],
    cta: { label: 'Current Plan', href: '' },
  },
  {
    key: 'premium',
    name: 'Premium Plan',
    price: 'Coming Soon',
    badge: { label: 'Coming Soon', color: '#92400e', bg: '#fef3c7' },
    features: ['Unlimited job postings', 'Featured Jobs placement', 'AI candidate search', 'Priority support'],
    cta: { label: 'Notify Me', href: 'mailto:support@noblejob.in?subject=Notify%20me%20about%20Premium%20Plan' },
    highlight: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    badge: { label: 'Contact Sales', color: '#1847d4', bg: '#eff6ff' },
    features: ['Custom job posting volume', 'Dedicated account manager', 'API & bulk-posting access', 'Custom integrations'],
    cta: { label: 'Contact Sales', href: 'mailto:support@noblejob.in?subject=Enterprise%20Plan%20Enquiry' },
  },
]

/**
 * Static, honest plans overview — no payment integration exists yet, so this
 * deliberately never claims to process a purchase. Replaces a previous stub
 * that rendered "Loading upgrade…" permanently (no fetch ever ran).
 */
export function UpgradeCta() {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20, marginBottom: 16 }}>
      <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 16, marginBottom: 4 }}>⚡ Plans</h3>
      <p style={{ color: '#6b7280', fontSize: 12.5, marginBottom: 16 }}>Compare plans below. Premium is coming soon — Enterprise is available today via our sales team.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        {PLANS.map(plan => (
          <div key={plan.key} style={{
            border: plan.highlight ? '1.5px solid #1847d4' : '1.5px solid #e2e8f0',
            borderRadius: 12, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 10,
            background: plan.highlight ? '#f8faff' : '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 15 }}>{plan.name}</div>
              {plan.badge && (
                <span style={{ fontSize: 10.5, fontWeight: 800, color: plan.badge.color, background: plan.badge.bg, padding: '3px 9px', borderRadius: 20 }}>
                  {plan.badge.label}
                </span>
              )}
            </div>
            <div style={{ fontWeight: 800, color: '#1847d4', fontSize: 18 }}>{plan.price}</div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {plan.features.map(f => (
                <li key={f} style={{ fontSize: 12.5, color: '#374151', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span style={{ color: '#15803d', flexShrink: 0 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            {plan.cta.href ? (
              <a href={plan.cta.href} style={{
                marginTop: 'auto', textAlign: 'center', textDecoration: 'none', fontWeight: 800, fontSize: 12.5,
                padding: '9px 12px', borderRadius: 9,
                background: plan.highlight ? '#1847d4' : '#fff',
                color: plan.highlight ? '#fff' : '#1847d4',
                border: plan.highlight ? 'none' : '1.5px solid #1847d4',
              }}>
                {plan.cta.label}
              </a>
            ) : (
              <div style={{ marginTop: 'auto', textAlign: 'center', fontWeight: 800, fontSize: 12.5, padding: '9px 12px', borderRadius: 9, background: '#f1f5f9', color: '#64748b' }}>
                {plan.cta.label}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #eef2fb', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11.5, color: '#9ca3af', margin: 0 }}>Have questions about which plan fits your hiring needs?</p>
        <a href="/contact" style={{ fontSize: 12.5, fontWeight: 800, color: '#1847d4', textDecoration: 'none', border: '1.5px solid #1847d4', borderRadius: 9, padding: '8px 16px' }}>
          Request a Demo →
        </a>
      </div>
    </div>
  )
}
