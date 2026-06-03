import Link from'next/link'
export function AiRecommendations(){
  return(
    <div style={{background:'linear-gradient(135deg,#1847d4,#0d1f4e)',borderRadius:14,padding:'20px 18px',color:'#fff'}}>
      <div style={{fontSize:32,marginBottom:8}}>🤖</div>
      <h3 style={{fontFamily:'Playfair Display,serif',fontWeight:900,fontSize:16,marginBottom:8}}>AI Recommendations</h3>
      <p style={{fontSize:12.5,color:'rgba(255,255,255,.8)',lineHeight:1.6,marginBottom:14}}>Get govt jobs matched to your qualification and location.</p>
      <Link href="/auth?role=candidate&tab=register" style={{display:'block',background:'#f07020',color:'#fff',padding:'9px 14px',borderRadius:9,fontWeight:800,fontSize:13,textDecoration:'none',textAlign:'center'}}>Get Matched →</Link>
    </div>
  )
}
