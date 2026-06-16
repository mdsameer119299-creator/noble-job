'use client'
import Link from'next/link'
import{usePathname}from'next/navigation'
const NAV=[
  {href:'/admin/dashboard',label:'Overview',icon:'📊'},
  {href:'/admin/approvals',label:'Approvals',icon:'✅'},
  {href:'/admin/jobs',label:'All Jobs',icon:'💼'},
  {href:'/admin/employers',label:'Employers',icon:'🏢'},
  {href:'/admin/candidates',label:'Candidates',icon:'👥'},
  {href:'/admin/applications',label:'Applications',icon:'📋'},
  {href:'/admin/messages',label:'Messages',icon:'📬'},
  {href:'/admin/content',label:'Site Content',icon:'📝'},
  {href:'/admin/settings',label:'Settings',icon:'⚙️'},
]
export function AdminSidebar(){
  const path=usePathname()
  return(
    <aside style={{width:230,flexShrink:0,position:'sticky',top:110}}>
      <div style={{background:'#fff',borderRadius:16,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 4px 20px rgba(24,71,212,.06)'}}>
        <div style={{background:'linear-gradient(135deg,#0d1f4e,#1e3a8a)',padding:'20px 18px'}}>
          <div style={{fontSize:28,marginBottom:8}}>🛡️</div>
          <div style={{color:'#fff',fontWeight:900,fontSize:15}}>Admin Panel</div>
          <div style={{color:'rgba(255,255,255,.6)',fontSize:12}}>Noble Job · NCC Foundation</div>
        </div>
        <nav style={{padding:'8px 0'}}>
          {NAV.map(n=>{
            const active=path===n.href||path.startsWith(n.href+'/')
            return(
              <Link key={n.href} href={n.href}
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 18px',fontSize:13.5,fontWeight:active?800:600,textDecoration:'none',transition:'all .15s',background:active?'#eff6ff':'transparent',color:active?'#1847d4':'#374151',borderRight:active?'3px solid #1847d4':'3px solid transparent'}}>
                <span style={{fontSize:16}}>{n.icon}</span>{n.label}
              </Link>
            )
          })}
        </nav>
        <div style={{padding:'12px 18px',borderTop:'1px solid #f0f4ff'}}>
          <form action="/api/auth/logout" method="POST">
            <button style={{width:'100%',background:'#fef2f2',border:'1.5px solid #fca5a5',color:'#dc2626',padding:'9px 14px',borderRadius:9,fontWeight:800,fontSize:13,cursor:'pointer'}}>🚪 Logout</button>
          </form>
        </div>
      </div>
    </aside>
  )
}
