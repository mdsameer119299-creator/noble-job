import{ContentEditor}from'@/components/admin/ContentEditor'
export default function AdminContentPage(){
  return(
    <div>
      <h1 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',fontSize:26,marginBottom:24}}>Site Content</h1>
      <ContentEditor/>
    </div>
  )
}
