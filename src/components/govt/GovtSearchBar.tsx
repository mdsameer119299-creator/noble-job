'use client'
import{INDIA_STATES}from'@/lib/constants/govtStates'
interface GovtSearchBarProps{q:string;state:string;onQ:(v:string)=>void;onState:(v:string)=>void}
export function GovtSearchBar({q,state,onQ,onState}:GovtSearchBarProps){
  return(
    <div style={{background:'#fff',borderRadius:12,border:'1.5px solid #e2e8f0',padding:'10px 14px',display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:18}}>
      <input value={q} onChange={e=>onQ(e.target.value)} placeholder="Search govt jobs, department, post…" style={{flex:1,border:'none',outline:'none',fontSize:14,color:'#0d1f4e',minWidth:200}}/>
      <select value={state} onChange={e=>onState(e.target.value)} style={{border:'1.5px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13,color:'#374151',background:'#fff'}}>
        <option value="">All States</option>
        {INDIA_STATES.map(s=><option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  )
}
