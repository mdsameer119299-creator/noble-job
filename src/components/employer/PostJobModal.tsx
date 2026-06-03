'use client'
import{useState}from'react'
import{Modal}from'@/components/ui/Modal'
import{Input}from'@/components/ui/Input'
import{Textarea}from'@/components/ui/Textarea'
import{Select}from'@/components/ui/Select'
import{Button}from'@/components/ui/Button'
import{useToast}from'@/hooks/useToast'
import{JOB_CATEGORIES,JOB_TYPES}from'@/lib/constants/jobCategories'
interface PostJobModalProps{open:boolean;onClose:()=>void;onPosted:()=>void}
export function PostJobModal({open,onClose,onPosted}:PostJobModalProps){
  const[form,setForm]=useState({title:'',location:'',salaryMin:'',salaryMax:'',jobType:'Full Time',category:'',skills:'',description:''})
  const[loading,setLoading]=useState(false)
  const toast=useToast()
  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}))
  const handlePost=async()=>{
    if(!form.title||!form.location||!form.category||!form.description){toast.error('Fill all required fields');return}
    if(form.description.length<50){toast.error('Description must be at least 50 characters');return}
    setLoading(true)
    const res=await fetch('/api/employer/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,skills:form.skills.split(',').map((s:string)=>s.trim()).filter(Boolean),salary_min:Number(form.salaryMin)||null,salary_max:Number(form.salaryMax)||null,job_type:form.jobType})})
    if(res.ok){toast.success('Job posted for review!');onPosted();onClose()}
    else toast.error('Failed to post job')
    setLoading(false)
  }
  return(
    <Modal open={open} onClose={onClose} maxWidth="640px">
      <div style={{background:'linear-gradient(135deg,#0d1f4e,#1847d4)',padding:'22px 26px'}}>
        <button onClick={onClose} style={{position:'absolute',top:14,right:14,background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:36,height:36,borderRadius:'50%',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10}}>×</button>
        <h2 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#fff',fontSize:22}}>Post a New Job</h2>
        <p style={{color:'rgba(255,255,255,.75)',fontSize:13}}>Reach 80,000+ qualified candidates on Noble Job</p>
      </div>
      <div style={{padding:'24px 26px',display:'flex',flexDirection:'column',gap:14}}>
        <Input label="Job Title *" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Senior React Developer"/>
        <div className="post-job-form-grid">
          <Input label="Location *" value={form.location} onChange={e=>set('location',e.target.value)} placeholder="e.g. Bangalore / Remote"/>
          <Select label="Job Type" value={form.jobType} onChange={e=>set('jobType',e.target.value)} options={JOB_TYPES.map(t=>({label:t,value:t}))}/>
        </div>
        <Select label="Category *" value={form.category} onChange={e=>set('category',e.target.value)} options={[{label:'Select category',value:''},...JOB_CATEGORIES.map(c=>({label:c,value:c}))]}/>
        <div className="post-job-form-grid">
          <Input label="Min Salary (₹/yr)" type="number" value={form.salaryMin} onChange={e=>set('salaryMin',e.target.value)} placeholder="e.g. 600000"/>
          <Input label="Max Salary (₹/yr)" type="number" value={form.salaryMax} onChange={e=>set('salaryMax',e.target.value)} placeholder="e.g. 1200000"/>
        </div>
        <Input label="Required Skills (comma-separated)" value={form.skills} onChange={e=>set('skills',e.target.value)} placeholder="e.g. React, TypeScript, Node.js"/>
        <Textarea label="Job Description *" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Describe the role, responsibilities, and requirements (min 50 chars)"/>
        <div style={{display:'flex',gap:10}}>
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="blue" onClick={handlePost} loading={loading} className="flex-1">Post Job for Review</Button>
        </div>
      </div>
    </Modal>
  )
}
