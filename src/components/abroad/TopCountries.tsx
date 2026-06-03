import{CountryCard}from'./CountryCard'
import{TOP_HIRING_COUNTRIES}from'@/lib/constants/abroadCountries'
interface TopCountriesProps{onCountry:(c:string)=>void}
export function TopCountries({onCountry}:TopCountriesProps){
  return(
    <div style={{marginBottom:24}}>
      <h3 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',marginBottom:14}}>Top Hiring Countries</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10}}>
        {TOP_HIRING_COUNTRIES.map(c=><CountryCard key={c.name} country={c} onClick={()=>onCountry(c.name)}/>)}
      </div>
    </div>
  )
}
