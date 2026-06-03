'use client'
import{INDIA_STATES}from'@/lib/constants/govtStates'
interface GovtFilterSidebarProps{state:string;onState:(v:string)=>void}
export function GovtFilterSidebar({state,onState}:GovtFilterSidebarProps){
  return(
    <aside style={{width:210,flexShrink:0}}>
      <div style={{background:'#fff',borderRadius:16,border:'1.5px solid #e2e8f0',padding:'18px 16px'}}>
        <h3 style={{fontWeight:900,color:'#0d1f4e',fontSize:15,marginBottom:18}}>Filter by State</h3>
        <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer'}}>
          <input type="radio" name="state" checked={state===''} onChange={()=>onState('')} style={{accentColor:'#1847d4'}}/>
          <span style={{fontSize:13,color:'#374151'}}>All India</span>
        </label>
        {INDIA_STATES.map(s=>(
          <label key={s} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7,cursor:'pointer'}}>
            <input type="radio" name="state" checked={state===s} onChange={()=>onState(s)} style={{accentColor:'#1847d4'}}/>
            <span style={{fontSize:13,color:'#374151'}}>{s}</span>
          </label>
        ))}
      </div>
    </aside>
  )
}
