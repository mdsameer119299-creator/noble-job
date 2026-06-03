'use client'
import{TOP_HIRING_COUNTRIES}from'@/lib/constants/abroadCountries'
interface AbroadSearchBarProps{q:string;country:string;onQ:(v:string)=>void;onCountry:(v:string)=>void}
export function AbroadSearchBar({q,country,onQ,onCountry}:AbroadSearchBarProps){
  return(
    <div style={{background:'#fff',borderRadius:12,border:'1.5px solid #e2e8f0',padding:'10px 14px',display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:18}}>
      <input value={q} onChange={e=>onQ(e.target.value)} placeholder="Search abroad jobs, company, role…" style={{flex:1,border:'none',outline:'none',fontSize:14,color:'#0d1f4e',minWidth:200}}/>
      <select value={country} onChange={e=>onCountry(e.target.value)} style={{border:'1.5px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13,color:'#374151',background:'#fff'}}>
        <option value="">All Countries</option>
        {TOP_HIRING_COUNTRIES.map(c=><option key={c.name} value={c.name}>{c.flag} {c.name}</option>)}
      </select>
    </div>
  )
}
