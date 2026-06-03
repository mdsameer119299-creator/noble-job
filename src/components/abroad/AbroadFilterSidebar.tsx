'use client'
import{TOP_HIRING_COUNTRIES}from'@/lib/constants/abroadCountries'
interface AbroadFilterSidebarProps{country:string;onCountry:(v:string)=>void}
export function AbroadFilterSidebar({country,onCountry}:AbroadFilterSidebarProps){
  return(
    <aside style={{width:210,flexShrink:0}}>
      <div style={{background:'#fff',borderRadius:16,border:'1.5px solid #e2e8f0',padding:'18px 16px'}}>
        <h3 style={{fontWeight:900,color:'#0d1f4e',fontSize:15,marginBottom:16}}>Filter by Country</h3>
        <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer'}}>
          <input type="radio" name="country" checked={country===''} onChange={()=>onCountry('')} style={{accentColor:'#0369a1'}}/>
          <span style={{fontSize:13,color:'#374151'}}>All Countries</span>
        </label>
        {TOP_HIRING_COUNTRIES.map(c=>(
          <label key={c.name} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7,cursor:'pointer'}}>
            <input type="radio" name="country" checked={country===c.name} onChange={()=>onCountry(c.name)} style={{accentColor:'#0369a1'}}/>
            <span style={{fontSize:13,color:'#374151'}}>{c.flag} {c.name}</span>
          </label>
        ))}
      </div>
    </aside>
  )
}
