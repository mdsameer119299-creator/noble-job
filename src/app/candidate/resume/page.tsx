import{ResumeViewer}from'@/components/candidate/ResumeViewer'
import{ResumeScoreCard}from'@/components/candidate/ResumeScoreCard'
export default function CandidateResumeViewerPage(){
  return(
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <h1 className="page-title">My Resume</h1>
      <ResumeViewer/>
      <ResumeScoreCard/>
    </div>
  )
}
