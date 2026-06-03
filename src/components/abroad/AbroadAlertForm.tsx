'use client'
import{EmailAlertForm}from'@/components/jobs/EmailAlertForm'
export function AbroadAlertForm(){
  return(
    <div style={{background:'#fff',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'18px 16px'}}>
      <h4 style={{fontWeight:800,color:'#0d1f4e',marginBottom:8,fontSize:14}}>✈️ Abroad Job Alerts</h4>
      <p style={{fontSize:12,color:'#6b7280',marginBottom:10}}>Get new international jobs delivered daily.</p>
      <EmailAlertForm board="abroad" placeholder="Email for abroad alerts"/>
    </div>
  )
}
