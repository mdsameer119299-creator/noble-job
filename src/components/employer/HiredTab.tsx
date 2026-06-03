'use client'
interface HiredTabProps{[key:string]:any}
export function HiredTab(props:HiredTabProps){
  return(
    <div style={{background:'#fff',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'20px',marginBottom:16}}>
      <h3 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:16,marginBottom:12}}>🏆 Hired</h3>
      <p style={{color:'#6b7280',fontSize:13}}>Loading hired…</p>
    </div>
  )
}
