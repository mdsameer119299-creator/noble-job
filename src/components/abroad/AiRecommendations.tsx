import Link from'next/link'
export function AiRecommendations(){
  return(
    <div style={{background:'#fff',borderRadius:14,border:'2px solid #0369a1',padding:'18px 16px'}}>
      <div style={{fontSize:28,marginBottom:8}}>🤖</div>
      <h4 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:15,marginBottom:6}}>AI Abroad Matching</h4>
      <p style={{fontSize:12,color:'#6b7280',marginBottom:12}}>Get matched to the best country and role for your profile.</p>
      <Link href="/auth?role=candidate&tab=register" style={{display:'block',background:'#0369a1',color:'#fff',padding:'9px 14px',borderRadius:9,fontWeight:800,fontSize:13,textDecoration:'none',textAlign:'center'}}>Get Matched →</Link>
    </div>
  )
}
