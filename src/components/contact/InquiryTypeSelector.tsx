'use client'
import{InquiryIcon}from'./InquiryIcon'
const TYPES=[{id:'general',label:'General'},{id:'support',label:'Support'},{id:'employer',label:'Employer'},{id:'candidate',label:'Job Seeker'},{id:'partnership',label:'Partnership'},{id:'feedback',label:'Feedback'}]
interface InquiryTypeSelectorProps{value:string;onChange:(v:string)=>void}
export function InquiryTypeSelector({value,onChange}:InquiryTypeSelectorProps){
  return(
    <div style={{marginBottom:20}}>
      <label style={{display:'block',fontSize:13,fontWeight:700,color:'#0d1f4e',marginBottom:10}}>Inquiry Type</label>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
        {TYPES.map(t=>(
          <button key={t.id} type="button" onClick={()=>onChange(t.id)}
            style={{padding:'10px 8px',borderRadius:10,border:'1.5px solid',cursor:'pointer',textAlign:'center',transition:'all .2s',borderColor:value===t.id?'#1847d4':'#e2e8f0',background:value===t.id?'#eff6ff':'#fff'}}>
            <InquiryIcon type={t.id} size={20}/>
            <div style={{fontSize:12,fontWeight:700,color:value===t.id?'#1847d4':'#374151',marginTop:4}}>{t.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
