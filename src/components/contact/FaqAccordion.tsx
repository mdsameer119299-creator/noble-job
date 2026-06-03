import{FaqItem}from'./FaqItem'
const FAQS=[
  {q:'Is Noble Job free for candidates?',a:'Yes, 100% free. Noble Job never charges job seekers for registration, applications or any services. We earn from employer subscriptions only.'},
  {q:'How do I report a fake job?',a:'Email us at feedback@noblejob.in with the job title and company name. We review all reports within 24 hours and remove scam listings immediately.'},
  {q:'How can employers post a job?',a:'Register as an Employer, complete your company profile, and click "Post a Job". Freshers and early-stage companies get 3 free job posts.'},
  {q:'How long does it take to get a response?',a:'During office hours (Mon-Sat, 10 AM - 6:30 PM IST), we typically respond within 2-4 hours. Outside hours, expect a response by the next business day.'},
  {q:'Do you offer WFH and abroad job placements?',a:'Yes. Our WFH section lists genuine remote jobs from verified Indian companies. Our Abroad section covers UAE, UK, Canada, USA, Australia and more with visa guidance.'},
]
export function FaqAccordion(){
  return(
    <div style={{background:'#fff',borderRadius:16,border:'1.5px solid #e2e8f0',padding:'24px'}}>
      <h3 style={{fontFamily:'Playfair Display,serif',fontWeight:900,color:'#0d1f4e',marginBottom:18}}>Frequently Asked Questions</h3>
      {FAQS.map((f,i)=><FaqItem key={i} q={f.q} a={f.a}/>)}
    </div>
  )
}
