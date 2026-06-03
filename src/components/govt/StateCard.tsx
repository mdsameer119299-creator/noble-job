interface StateCardProps{state:string;onClick:()=>void}
export function StateCard({state,onClick}:StateCardProps){
  return(
    <button onClick={onClick} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:10,padding:'10px 12px',cursor:'pointer',textAlign:'center',transition:'all .2s',fontSize:13,fontWeight:700,color:'#0d1f4e'}} className="hover:border-noble-blue hover:text-noble-blue hover:bg-blue-50">
      🗺️ {state}
    </button>
  )
}
