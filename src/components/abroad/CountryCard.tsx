interface Country{name:string;flag:string;jobs:number;desc:string}
interface CountryCardProps{country:Country;onClick:()=>void}
export function CountryCard({country,onClick}:CountryCardProps){
  return(
    <button onClick={onClick} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:12,padding:'14px 12px',cursor:'pointer',textAlign:'center',transition:'all .2s',width:'100%'}} className="hover:border-noble-blue hover:bg-blue-50">
      <div style={{fontSize:28,marginBottom:6}}>{country.flag}</div>
      <div style={{fontWeight:800,color:'#0d1f4e',fontSize:13,marginBottom:2}}>{country.name}</div>
      <div style={{fontSize:11,color:'#1847d4',fontWeight:700}}>{country.jobs.toLocaleString('en-IN')}+ jobs</div>
      <div style={{fontSize:10.5,color:'#6b7280',marginTop:2}}>{country.desc}</div>
    </button>
  )
}
