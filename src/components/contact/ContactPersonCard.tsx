import{CONTACT_INFO}from'@/lib/constants/contactInfo'
export function ContactPersonCard(){
  return(
    <div style={{display:'flex',alignItems:'center',gap:16,background:'#eff6ff',borderRadius:14,padding:'18px 20px',border:'1.5px solid #bfdbfe',marginBottom:24}}>
      <div style={{width:56,height:56,borderRadius:'50%',background:'linear-gradient(135deg,#1847d4,#0d1f4e)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:20,flexShrink:0}}>N</div>
      <div>
        <div style={{fontWeight:900,color:'#0d1f4e',fontSize:16}}>{CONTACT_INFO.person}</div>
        <div style={{color:'#6b7280',fontSize:13}}>{CONTACT_INFO.role} · Noble Job / NCC Foundation</div>
        <div style={{display:'flex',gap:10,marginTop:6}}>
          <a href={CONTACT_INFO.phoneTel} style={{color:'#1847d4',fontSize:12.5,fontWeight:700,textDecoration:'none'}}>📞 {CONTACT_INFO.phone}</a>
          <a href={CONTACT_INFO.emailTo} style={{color:'#1847d4',fontSize:12.5,fontWeight:700,textDecoration:'none'}}>✉️ {CONTACT_INFO.email}</a>
        </div>
      </div>
    </div>
  )
}
