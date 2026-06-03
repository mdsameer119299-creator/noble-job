import Link from'next/link'
export function DreamJobCta(){
  return(
    <div style={{background:'linear-gradient(135deg,#0369a1,#0d1f4e)',borderRadius:14,padding:'20px 18px',color:'#fff',textAlign:'center'}}>
      <div style={{fontSize:36,marginBottom:8}}>🌍</div>
      <h3 style={{fontFamily:'Playfair Display,serif',fontWeight:900,fontSize:16,marginBottom:8}}>Your Dream Job Abroad</h3>
      <p style={{fontSize:12.5,color:'rgba(255,255,255,.8)',lineHeight:1.6,marginBottom:14}}>Free consultation for visa guidance and international job applications.</p>
      <Link href="/contact" style={{display:'block',background:'#f07020',color:'#fff',padding:'10px 14px',borderRadius:9,fontWeight:800,fontSize:13,textDecoration:'none'}}>Get Free Guidance →</Link>
    </div>
  )
}
