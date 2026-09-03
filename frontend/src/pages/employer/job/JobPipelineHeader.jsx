import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, ProgressBar } from '../../../components/shared'
import { closeJob } from '../../../api/jobs'

const TABS = [
  { key: 'pipeline', label: 'Pipeline', to: (id) => `/employer/jobs/${id}` },
  { key: 'ranked', label: 'Ranked list', to: (id) => `/employer/jobs/${id}/ranked` },
  { key: 'settings', label: 'Job settings', to: (id) => `/employer/jobs/${id}/settings` },
]

function JobPipelineHeader({ job, activeTab }) {
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)

  const handleClose = async () => {
    if (!window.confirm('Close this job? It will stop accepting new submissions.')) return
    setClosing(true)
    try {
      await closeJob(job.id)
      navigate('/employer/dashboard')
    } catch {
      setClosing(false)
      window.alert("Couldn't close this job. Try again.")
    }
  }

  return (
    <>
      <div className="bg-ink px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/employer/dashboard" className="text-sm font-bold text-white/70 hover:text-white">
            ← Back to jobs
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-ink">{job.title}</h1>
          <div className="flex items-center gap-3">
            <Link to={`/employer/jobs/${job.id}/edit`}>
              <Button variant="default">Edit</Button>
            </Link>
            {job.status === 'published' && (
              <Button variant="default" disabled={closing} onClick={handleClose}>
                {closing ? 'Closing...' : 'Close job'}
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-slate mb-1.5">
          {job.slots_filled} of {job.guaranteed_slots} slots filled
        </p>
        <ProgressBar value={job.slots_filled} max={job.guaranteed_slots} className="mb-6" />

        {/* overflow-x-auto instead of wrapping — three tabs with an active
            underline look wrong wrapped onto two lines, but scroll cleanly
            on a narrow screen */}
        <div className="flex items-center gap-4 sm:gap-6 border-b border-slate/20 overflow-x-auto">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              to={tab.to(job.id)}
              className={`pb-3 text-sm font-bold border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.key
                  ? 'text-ink border-brass'
                  : 'text-slate border-transparent hover:text-ink'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}

export default JobPipelineHeader
