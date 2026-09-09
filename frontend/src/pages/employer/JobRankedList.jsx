import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, EmptyState } from '../../components/shared'
import { getJob, getJobSubmissions } from '../../api/jobs'

function SelectionIndicator({ slotNumber, hasFlags }) {
  if (slotNumber) {
    return <span className="w-3 h-3 rounded-full bg-brass shrink-0" aria-hidden="true" />
  }
  if (hasFlags) {
    return <span className="w-3 h-3 rounded-full bg-red-400 shrink-0" aria-hidden="true" />
  }
  return (
    <span className="w-3 h-3 rounded-full border-2 border-slate/40 shrink-0" aria-hidden="true" />
  )
}

function JobRankedList() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    Promise.all([getJob(id), getJobSubmissions(id, { sort: 'rank' })])
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
        <p className="text-sm text-slate">Loading candidates...</p>
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
      <div className="bg-ink px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-bold text-white">Candidates</span>
        <Link to={`/employer/jobs/${job.id}`} className="text-sm font-bold text-white/70 hover:text-white">
          {job.title}
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {submissions.length === 0 && (
          <EmptyState
            title="No candidates yet"
            message="Candidates will appear here once they complete the assessment."
            actionLabel="View pipeline"
            actionTo={`/employer/jobs/${job.id}`}
          />
        )}

        {submissions.length > 0 && (
        <div className="flex flex-col rounded-xl overflow-hidden border border-slate/15">
          {submissions.map((sub, index) => {
            const hasFlags = sub.flags?.length > 0
            return (
              <div
                key={sub.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-4 ${
                  hasFlags ? 'bg-red-500/5' : 'bg-card'
                } ${index !== submissions.length - 1 ? 'border-b border-slate/15' : ''}`}
              >
                {/* Name+indicator take their own full-width line on mobile,
                    since it's the one thing that shouldn't get squeezed or
                    truncated unpredictably next to the badges. */}
                <div className="flex items-center gap-3 min-w-0 basis-full sm:basis-auto sm:w-36">
                  <SelectionIndicator slotNumber={sub.slot_number} hasFlags={hasFlags} />
                  <span className="font-bold text-ink truncate">{sub.candidate_name}</span>
                </div>

                <span className="text-xs text-slate w-24">
                  {sub.slot_number ? `Slot ${sub.slot_number}` : hasFlags ? 'Flagged' : '—'}
                </span>

                <Badge variant={sub.status?.startsWith('passed') ? 'success' : 'slate'}>
                  {sub.status?.startsWith('passed') ? 'Passed' : 'Not qual.'}
                </Badge>

                <span className="text-xs text-slate w-14">AI {sub.overall_score ?? '—'}</span>

                {hasFlags && (
                  <Badge
                    variant="flag"
                    tooltip={sub.flags.map((f) => f.label).join('; ')}
                  />
                )}

                <Link
                  to={`/employer/jobs/${job.id}/candidates/${sub.candidate_id}`}
                  className="sm:ml-auto text-sm font-bold text-brass hover:underline"
                >
                  View
                </Link>
              </div>
            )
          })}
        </div>
        )}

        {submissions.length > 0 && (
          <p className="text-xs text-slate mt-4">
            Deterministic pass/fail and the AI-advisory score are always shown as separate
            columns.
          </p>
        )}
      </div>
    </div>
  )
}

export default JobRankedList
