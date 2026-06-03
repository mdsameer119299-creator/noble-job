import{OFFICE_HOURS}from'@/lib/constants/officeHours'
import{OnlineStatusBadge}from'./OnlineStatusBadge'
export function OfficeHours(){
  return(
    <div style={{background:'#fff',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'20px 18px',marginBottom:18}}>
      <h4 style={{fontWeight:900,color:'#0d1f4e',fontSize:15,marginBottom:14}}>🕐 Office Hours</h4>
      <OnlineStatusBadge/>
      <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:10}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
          <span style={{color:'#374151',fontWeight:600}}>{OFFICE_HOURS.weekdays.label}</span>
          <span style={{color:'#1847d4',fontWeight:700}}>{OFFICE_HOURS.weekdays.open} – {OFFICE_HOURS.weekdays.close}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
          <span style={{color:'#374151',fontWeight:600}}>{OFFICE_HOURS.sunday.label}</span>
          <span style={{color:'#dc2626',fontWeight:700}}>Closed</span>
        </div>
        <div style={{fontSize:12,color:'#6b7280',paddingTop:8,borderTop:'1px solid #f0f4ff'}}>All times in IST (India Standard Time)</div>
      </div>
    </div>
  )
}
