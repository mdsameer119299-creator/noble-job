import { SaveJobButton } from './SaveJobButton'
import { ShareJobButton } from './ShareJobButton'
import { PrintJobButton } from './PrintJobButton'
import { ReportJobButton } from './ReportJobButton'

interface JobActionBarProps {
  board: 'private' | 'wfh' | 'abroad' | 'govt'
  jobId: string
  jobTitle: string
}

export function JobActionBar({ board, jobId, jobTitle }: JobActionBarProps) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <SaveJobButton jobId={jobId} board={board} />
      <ShareJobButton title={jobTitle} />
      <PrintJobButton />
      <ReportJobButton board={board} jobId={jobId} jobTitle={jobTitle} />
    </div>
  )
}
