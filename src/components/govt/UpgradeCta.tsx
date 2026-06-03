import Link from'next/link'
export function UpgradeCta(){
  return(
    <div style={{background:'#fff',borderRadius:14,border:'2px solid #1847d4',padding:'18px 16px',textAlign:'center'}}>
      <div style={{fontSize:28,marginBottom:8}}>⚡</div>
      <h4 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:15,marginBottom:6}}>Govt Exam Prep</h4>
      <p style={{fontSize:12,color:'#6b7280',marginBottom:12}}>Prepare for SSC, Banking, Railway and more with expert guidance.</p>
      <Link href="/candidate/interview-prep" style={{display:'block',background:'#1847d4',color:'#fff',padding:'9px 14px',borderRadius:9,fontWeight:800,fontSize:13,textDecoration:'none'}}>Start Preparing →</Link>
    </div>
  )
}
