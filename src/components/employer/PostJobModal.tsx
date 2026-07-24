'use client'
import{useState}from'react'
import{Modal}from'@/components/ui/Modal'
import{Input}from'@/components/ui/Input'
import{Textarea}from'@/components/ui/Textarea'
import{Select}from'@/components/ui/Select'
import{Button}from'@/components/ui/Button'
import{useToast}from'@/hooks/useToast'
import{JOB_CATEGORIES,WFH_CATEGORIES,JOB_TYPES}from'@/lib/constants/jobCategories'

type Board='private'|'wfh'|'abroad'
const BOARD_TABS:{board:Board;label:string}[]=[
  {board:'private',label:'Private Job'},
  {board:'wfh',label:'Work From Home'},
  {board:'abroad',label:'Abroad'},
]

interface PostJobModalProps{open:boolean;onClose:()=>void;onPosted:()=>void}

const EMPTY_FORM={
  title:'',company:'',location:'',country:'',salaryMin:'',salaryMax:'',salary:'',
  jobType:'Full Time',category:'',qualification:'',experience:'',skills:'',description:'',
}

export function PostJobModal({open,onClose,onPosted}:PostJobModalProps){
  const[board,setBoard]=useState<Board>('private')
  const[form,setForm]=useState(EMPTY_FORM)
  const[loading,setLoading]=useState(false)
  const toast=useToast()
  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}))

  const switchBoard=(b:Board)=>{setBoard(b);setForm(EMPTY_FORM)}

  const handlePost=async()=>{
    if(!form.title||!form.description){toast.error('Fill all required fields');return}
    if(form.description.length<50){toast.error('Description must be at least 50 characters');return}
    if(board==='private'&&(!form.location||!form.category)){toast.error('Fill all required fields');return}
    if(board==='wfh'&&!form.category){toast.error('Category is required');return}
    if(board==='abroad'&&(!form.country||!form.category)){toast.error('Country and category are required');return}

    setLoading(true)
    const skills=form.skills.split(',').map((s:string)=>s.trim()).filter(Boolean)
    const payload:Record<string,unknown>={board,title:form.title,company:form.company,description:form.description,skills,job_type:form.jobType}
    if(board==='private'){
      payload.location=form.location
      payload.category=form.category
      payload.salary_min=Number(form.salaryMin)||null
      payload.salary_max=Number(form.salaryMax)||null
    }else if(board==='wfh'){
      payload.category=form.category
      payload.qualification=form.qualification
      payload.experience=form.experience
      payload.salary=form.salary
    }else{
      payload.country=form.country
      payload.location=form.location
      payload.category=form.category
      payload.experience=form.experience
      payload.salary=form.salary
    }
    const res=await fetch('/api/employer/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    if(res.ok){toast.success('Job posted for review!');onPosted();onClose();setForm(EMPTY_FORM);setBoard('private')}
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
      <div style={{display:'flex',gap:4,padding:'14px 26px 0',borderBottom:'1.5px solid #eef2fb'}}>
        {BOARD_TABS.map(t=>(
          <button key={t.board} type="button" onClick={()=>switchBoard(t.board)}
            style={{padding:'10px 16px',border:'none',background:'none',cursor:'pointer',fontWeight:800,fontSize:13.5,color:board===t.board?'#1847d4':'#6b7280',borderBottom:board===t.board?'2.5px solid #1847d4':'2.5px solid transparent',marginBottom:-1.5}}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{padding:'24px 26px',display:'flex',flexDirection:'column',gap:14}}>
        <Input label="Job Title *" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Senior React Developer"/>
        <Input label="Company Name" value={form.company} onChange={e=>set('company',e.target.value)} placeholder="Defaults to your registered company name"/>

        {board==='private'&&(
          <>
            <div className="post-job-form-grid">
              <Input label="Location *" value={form.location} onChange={e=>set('location',e.target.value)} placeholder="e.g. Bangalore"/>
              <Select label="Job Type" value={form.jobType} onChange={e=>set('jobType',e.target.value)} options={JOB_TYPES.map(t=>({label:t,value:t}))}/>
            </div>
            <Select label="Category *" value={form.category} onChange={e=>set('category',e.target.value)} options={[{label:'Select category',value:''},...JOB_CATEGORIES.map(c=>({label:c,value:c}))]}/>
            <div className="post-job-form-grid">
              <Input label="Min Salary (₹/yr)" type="number" value={form.salaryMin} onChange={e=>set('salaryMin',e.target.value)} placeholder="e.g. 600000"/>
              <Input label="Max Salary (₹/yr)" type="number" value={form.salaryMax} onChange={e=>set('salaryMax',e.target.value)} placeholder="e.g. 1200000"/>
            </div>
          </>
        )}

        {board==='wfh'&&(
          <>
            <Select label="Category *" value={form.category} onChange={e=>set('category',e.target.value)} options={[{label:'Select category',value:''},...WFH_CATEGORIES.map(c=>({label:c,value:c}))]}/>
            <div className="post-job-form-grid">
              <Input label="Qualification" value={form.qualification} onChange={e=>set('qualification',e.target.value)} placeholder="e.g. Any Graduate"/>
              <Input label="Experience" value={form.experience} onChange={e=>set('experience',e.target.value)} placeholder="e.g. 1-3 Years"/>
            </div>
            <Input label="Salary" value={form.salary} onChange={e=>set('salary',e.target.value)} placeholder="e.g. ₹6-10 LPA"/>
          </>
        )}

        {board==='abroad'&&(
          <>
            <div className="post-job-form-grid">
              <Input label="Country *" value={form.country} onChange={e=>set('country',e.target.value)} placeholder="e.g. UAE"/>
              <Input label="City / Location" value={form.location} onChange={e=>set('location',e.target.value)} placeholder="e.g. Dubai"/>
            </div>
            <Select label="Category *" value={form.category} onChange={e=>set('category',e.target.value)} options={[{label:'Select category',value:''},...JOB_CATEGORIES.map(c=>({label:c,value:c}))]}/>
            <div className="post-job-form-grid">
              <Input label="Experience" value={form.experience} onChange={e=>set('experience',e.target.value)} placeholder="e.g. 2-5 Years"/>
              <Input label="Salary" value={form.salary} onChange={e=>set('salary',e.target.value)} placeholder="e.g. AED 8,000-12,000/mo"/>
            </div>
          </>
        )}

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
