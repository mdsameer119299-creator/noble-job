// Individual collapsible section inside GovtDetailModal
interface GovtDetailSectionProps{title:string;children:React.ReactNode}
export function GovtDetailSection({title,children}:GovtDetailSectionProps){
  return(
    <div style={{marginBottom:18}}>
      <h4 style={{fontWeight:800,color:'#0d1f4e',marginBottom:10,padding:'8px 14px',background:'#f0f4ff',borderRadius:8,fontSize:14}}>{title}</h4>
      <div style={{padding:'0 4px'}}>{children}</div>
    </div>
  )
}
