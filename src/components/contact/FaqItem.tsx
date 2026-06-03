'use client'
import{useState}from'react'
interface FaqItemProps{q:string;a:string}
export function FaqItem({q,a}:FaqItemProps){
  const[open,setOpen]=useState(false)
  return(
    <div style={{borderBottom:'1px solid #f0f4ff',paddingBottom:12,marginBottom:12}}>
      <button onClick={()=>setOpen(!open)} style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0}}>
        <span style={{fontSize:14,fontWeight:700,color:'#0d1f4e',lineHeight:1.4}}>{q}</span>
        <span style={{fontSize:18,color:'#1847d4',flexShrink:0,marginLeft:12}}>{open?'−':'+'}</span>
      </button>
      {open&&<p style={{fontSize:13.5,color:'#374151',lineHeight:1.7,marginTop:10,paddingLeft:0}}>{a}</p>}
    </div>
  )
}
