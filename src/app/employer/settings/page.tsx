import{NotificationToggles}from'@/components/employer/NotificationToggles'
export default function EmployerSettingsPage(){
  return(
    <div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26,marginBottom:24}}>Account Settings</h1>
      <NotificationToggles/>
    </div>
  )
}
