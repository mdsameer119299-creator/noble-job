import{CONTACT_INFO}from'@/lib/constants/contactInfo'
import{SocialButtons}from'./SocialButtons'
import{OfficeHours}from'./OfficeHours'
export function ContactInfoPanel(){
  return(
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <OfficeHours/>
      <div style={{background:'#fff',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'20px 18px'}}>
        <h4 style={{fontWeight:900,color:'#0d1f4e',fontSize:15,marginBottom:14}}>📍 Contact Details</h4>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <a href={CONTACT_INFO.phoneTel} style={{display:'flex',alignItems:'center',gap:10,color:'#374151',textDecoration:'none',fontSize:13.5,fontWeight:600}}><span style={{fontSize:18}}>📞</span>{CONTACT_INFO.phone}</a>
          <a href={CONTACT_INFO.emailTo} style={{display:'flex',alignItems:'center',gap:10,color:'#374151',textDecoration:'none',fontSize:13.5,fontWeight:600}}><span style={{fontSize:18}}>✉️</span>{CONTACT_INFO.email}</a>
          <div style={{display:'flex',alignItems:'flex-start',gap:10,fontSize:13.5,color:'#374151',fontWeight:600}}><span style={{fontSize:18}}>📍</span><span>{CONTACT_INFO.address}</span></div>
        </div>
      </div>
      <SocialButtons/>
    </div>
  )
}
