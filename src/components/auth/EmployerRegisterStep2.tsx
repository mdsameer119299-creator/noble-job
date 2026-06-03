'use client'
interface EmployerRegisterStep2Props { form: any; onChange: (k: string, v: any) => void; errors: any }
const INDUSTRIES = ['IT / Software','Banking / Finance','Manufacturing','Healthcare','Retail','Education','Consulting','FMCG','E-commerce','Other']
const SIZES = ['1-10','11-50','51-200','201-500','501-1000','1000+']
export function EmployerRegisterStep2({ form, onChange, errors }: EmployerRegisterStep2Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>Company Name *</label>
        <input value={form.companyName || ''} onChange={e => onChange('companyName', e.target.value)} placeholder="Acme Corp Pvt Ltd"
          style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>Company Website</label>
        <input type="url" value={form.website || ''} onChange={e => onChange('website', e.target.value)} placeholder="https://yourcompany.com"
          style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>Industry</label>
          <select value={form.industry || ''} onChange={e => onChange('industry', e.target.value)}
            style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
            <option value="">Select industry</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>Company Size</label>
          <select value={form.companySize || ''} onChange={e => onChange('companySize', e.target.value)}
            style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
            <option value="">Select size</option>
            {SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>City</label>
        <input value={form.city || ''} onChange={e => onChange('city', e.target.value)} placeholder="New Delhi"
          style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>Your Designation</label>
        <input value={form.designation || ''} onChange={e => onChange('designation', e.target.value)} placeholder="e.g. HR Manager"
          style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
      </div>
    </div>
  )
}
