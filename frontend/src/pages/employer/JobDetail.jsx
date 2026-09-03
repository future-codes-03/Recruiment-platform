import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, Badge, EmptyState } from '../../components/shared'
import { getJob, getJobSubmissions } from '../../api/jobs'
import JobPipelineHeader from './job/JobPipelineHeader'

function JobDetail() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    Promise.all([getJob(id), getJobSubmissions(id, { status: 'submitted' })])
      .then(([jobData, submissionData]) => {
        if (cancelled) return
        setJob(jobData)
        setSubmissions(submissionData.results ?? submissionData)
      })
      .catch((err) => {
        if (cancelled) return
        if (err.response?.status === 404) setNotFound(true)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-sm text-slate">Loading job...</p>
      </div>
    )
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <EmptyState
          title="Job not found"
          message="This job may have been closed or the link is out of date."
          actionLabel="Back to dashboard"
          actionTo="/employer/dashboard"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      <JobPipelineHeader job={job} activeTab="pipeline" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-10 pt-8">
        <h2 className="text-[11px] uppercase tracking-widelabel text-slate font-bold mb-3">
          Recently completed
        </h2>

        <Card padded={false}>
          {submissions.length === 0 && (
            <p className="text-sm text-slate p-6">No candidates have completed the assessment yet.</p>
          )}
          {submissions.map((sub, index) => (
            <div
              key={sub.id}
              className={`flex items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-4 ${
                index !== submissions.length - 1 ? 'border-b border-slate/15' : ''
              }`}
            >
              <span className="font-bold text-ink flex-1 min-w-0 truncate">{sub.candidate_name}</span>
              <Badge variant={sub.status?.startsWith('passed') ? 'success' : 'slate'}>
                {sub.status?.startsWith('passed') ? 'Passed' : 'Not qual.'}
              </Badge>
              <span className="text-xs text-slate w-16 sm:w-24 text-center shrink-0">
                {sub.slot_number ? `Slot ${sub.slot_number}` : '—'}
              </span>
              <Link
                to={`/employer/jobs/${job.id}/candidates/${sub.candidate_id}`}
                className="text-sm font-bold text-brass hover:underline shrink-0"
              >
                View
              </Link>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

export default JobDetail
