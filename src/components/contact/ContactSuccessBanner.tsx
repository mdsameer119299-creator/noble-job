interface ContactSuccessBannerProps{onReset:()=>void}
export function ContactSuccessBanner({onReset}:ContactSuccessBannerProps){
  return(
    <div style={{textAlign:'center',padding:'32px 20px'}}>
      <div style={{fontSize:64,marginBottom:16}}>🎉</div>
      <h3 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:24,marginBottom:8}}>Message Sent Successfully!</h3>
      <p style={{color:'#6b7280',fontSize:15,lineHeight:1.7,marginBottom:24}}>Thank you for reaching out to Noble Job. Our team (Ms. Neha) will respond within 24 hours during office hours.</p>
      <button onClick={onReset} style={{background:'#1847d4',color:'#fff',border:'none',padding:'12px 28px',borderRadius:10,fontWeight:800,fontSize:14,cursor:'pointer'}}>Send Another Message</button>
    </div>
  )
}
