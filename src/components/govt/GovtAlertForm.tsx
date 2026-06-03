'use client'
import{EmailAlertForm}from'@/components/jobs/EmailAlertForm'
export function GovtAlertForm(){
  return(
    <div style={{background:'#fff',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'18px 16px'}}>
      <h4 style={{fontWeight:800,color:'#0d1f4e',marginBottom:8,fontSize:14}}>🔔 Govt Job Alerts</h4>
      <p style={{fontSize:12,color:'#6b7280',marginBottom:10}}>Get latest govt job notifications in your inbox.</p>
      <EmailAlertForm board="govt" placeholder="Your email for govt alerts" layout="stack" />
    </div>
  )
}
