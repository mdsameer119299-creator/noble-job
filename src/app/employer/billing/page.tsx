import{CurrentPlan}from'@/components/employer/CurrentPlan'
import{UpgradeCta}from'@/components/employer/UpgradeCta'
export default function EmployerBillingPage(){
  return(
    <div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26,marginBottom:24}}>Billing & Plans</h1>
      <CurrentPlan/>
      <div style={{marginTop:24}}>
        <UpgradeCta/>
      </div>
    </div>
  )
}
