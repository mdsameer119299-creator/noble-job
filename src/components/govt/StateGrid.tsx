import{StateCard}from'./StateCard'
import{INDIA_STATES}from'@/lib/constants/govtStates'
interface StateGridProps{onState:(s:string)=>void}
export function StateGrid({onState}:StateGridProps){
  return(
    <div>
      <h3 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',marginBottom:14}}>Browse by State</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10}}>
        {INDIA_STATES.map(s=><StateCard key={s} state={s} onClick={()=>onState(s)}/>)}
      </div>
    </div>
  )
}
