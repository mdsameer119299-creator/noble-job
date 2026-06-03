'use client'
import{useOnlineStatus}from'@/hooks/useOnlineStatus'
export function OnlineStatusBadge(){
  const online=useOnlineStatus()
  return(
    <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'6px 14px',borderRadius:20,background:online?'#f0fdf4':'#fef2f2',border:`1.5px solid ${online?'#86efac':'#fca5a5'}`}}>
      <span style={{width:8,height:8,borderRadius:'50%',background:online?'#22c55e':'#ef4444',display:'inline-block',animation:online?'pulse 2s infinite':'none'}}/>
      <span style={{fontSize:13,fontWeight:700,color:online?'#15803d':'#dc2626'}}>{online?'Online — Ready to Help':'Currently Offline'}</span>
    </div>
  )
}
