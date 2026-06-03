'use client'
import{useState}from'react'
import{useToast}from'@/hooks/useToast'
export function StarRating(){
  const[rating,setRating]=useState(0);const[hover,setHover]=useState(0);const[done,setDone]=useState(false)
  const toast=useToast()
  const handleRate=async(score:number)=>{
    setRating(score)
    await fetch('/api/ratings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({score,page:'contact'})})
    setDone(true);toast.success('Thank you for rating us!')
  }
  if(done)return<div style={{textAlign:'center',color:'#15803d',fontWeight:700,fontSize:14}}>⭐ Thanks for your feedback!</div>
  return(
    <div style={{textAlign:'center'}}>
      <p style={{fontSize:13,color:'#6b7280',marginBottom:10}}>Rate your experience with Noble Job</p>
      <div style={{display:'flex',gap:6,justifyContent:'center'}}>
        {[1,2,3,4,5].map(n=>(
          <button key={n} onMouseEnter={()=>setHover(n)} onMouseLeave={()=>setHover(0)} onClick={()=>handleRate(n)}
            style={{background:'none',border:'none',cursor:'pointer',fontSize:28,color:(hover||rating)>=n?'#fbbf24':'#e2e8f0',transition:'all .15s'}}>★</button>
        ))}
      </div>
    </div>
  )
}
