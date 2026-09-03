import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, Badge, Button, ProgressBar, EmptyState } from '../../components/shared'
import { getJob, getJobSubmissions } from '../../api/jobs'

const SEVERITY_STYLES = {
  medium: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Medium' },
  high: { dot: 'bg-red-500', text: 'text-red-700', label: 'High' },
}

function WarningIcon({ className = '' }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2 1 21h22L12 2Zm0 5.5 7 12.5H5l7-12.5ZM11 10v5h2v-5h-2Zm0 6.5V19h2v-2.5h-2Z" />
    </svg>
  )
}

function FlagRow({ flag }) {
  const [status, setStatus] = useState(null)
  const severity = SEVERITY_STYLES[flag.severity] ?? SEVERITY_STYLES.medium

  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-slate/10 last:border-b-0">
      <span className={`w-2 h-2 rounded-full shrink-0 ${severity.dot}`} aria-hidden="true" />
      <WarningIcon className="text-slate shrink-0" />

      <div className="flex-1">
        <p className="text-sm text-ink">{flag.label}{flag.description ? ` — ${flag.description}` : ''}</p>
        <span className={`text-xs font-bold ${severity.text}`}>{severity.label} severity</span>
      </div>

      {status ? (
        <span className="text-xs font-bold text-slate uppercase tracking-widelabel">{status}</span>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="default" className="!px-3 !py-1.5 text-xs" onClick={() => setStatus('Dismissed')}>
            Dismiss
          </Button>
          <Button variant="dark" className="!px-3 !py-1.5 text-xs" onClick={() => setStatus('Escalated')}>
            Escalate
          </Button>
        </div>
      )}
    </div>
  )
}

function CandidateDetail() {
  const { id, candidateId } = useParams()
  const [job, setJob] = useState(null)
  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [jobNotFound, setJobNotFound] = useState(false)
  const [codeTab, setCodeTab] = useState('code')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setJobNotFound(false)
    // No single-submission-by-employer endpoint exists yet, so we pull the
    // job's full submission list (same data JobRankedList uses) and find
    // this candidate's entry client-side.
    Promise.all([getJob(id), getJobSubmissions(id)])
      .then(([jobData, submissionData]) => {
        if (cancelled) return
        setJob(jobData)
        const list = submissionData.results ?? submissionData
        setSubmission(list.find((s) => s.candidate_id === candidateId) ?? null)
      })
      .catch((err) => {
        if (cancelled) return
        if (err.response?.status === 404) setJobNotFound(true)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id, candidateId])

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-sm text-slate">Loading candidate...</p>
      </div>
    )
  }

  if (jobNotFound || !job) {
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

  if (!submission) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <EmptyState
          title="Candidate not found"
          message="This candidate record may have moved or the link is out of date."
          actionLabel="Back to ranked list"
          actionTo={`/employer/jobs/${job.id}/ranked`}
        />
      </div>
    )
  }

  const passed = submission.status?.startsWith('passed')
  const statusLabel = passed ? 'Passed' : 'Not qualified'
  const skillScores = Object.entries(submission.per_skill_scores ?? {}).map(([name, score]) => ({
    name,
    score,
  }))
  const flags = submission.flags ?? []
  const testResults = submission.test_results ?? []

  return (
    <div className="min-h-screen bg-paper">
      <div className="bg-ink px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Link
            to={`/employer/jobs/${job.id}/ranked`}
            className="text-sm font-bold text-white/70 hover:text-white"
          >
            ← Back to ranked list
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <h1 className="text-3xl font-bold text-ink">{submission.candidate_name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant={passed ? 'success' : 'slate'}>{statusLabel}</Badge>
            {submission.slot_number && (
              <span className="text-sm font-bold text-slate">· Slot {submission.slot_number}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <h2 className="text-[11px] uppercase tracking-widelabel text-slate font-bold mb-4">
              Score table
            </h2>
            <div className="flex flex-col gap-4">
              {skillScores.map((skill) => (
                <div key={skill.name} className="flex items-center gap-3">
                  <span className="w-24 text-sm font-bold text-ink shrink-0">{skill.name}</span>
                  <ProgressBar value={skill.score} max={100} className="flex-1" />
                  <span className="w-10 text-sm font-bold text-ink text-right shrink-0">
                    {skill.score}%
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="!bg-brass/10">
            <h2 className="text-[11px] uppercase tracking-widelabel text-slate font-bold mb-3">
              AI summary
            </h2>
            <p className="text-sm text-ink leading-relaxed">{submission.ai_summary}</p>
          </Card>
        </div>

        {submission.transcript?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[11px] uppercase tracking-widelabel text-slate font-bold mb-3">
              Defense transcript
            </h2>
            <div className="bg-slate/10 rounded-xl p-5 flex flex-col gap-4">
              {submission.transcript.map((pair, index) => (
                <div key={index}>
                  <p className="text-sm font-bold text-ink mb-1">Q{index + 1}: {pair.question}</p>
                  <p className="text-sm text-slate">A{index + 1}: {pair.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(submission.submitted_code || testResults.length > 0) && (
          <div className="mb-8">
            <div className="flex items-center gap-6 border-b border-slate/20 mb-4">
              <button
                type="button"
                onClick={() => setCodeTab('code')}
                className={`pb-3 text-sm font-bold border-b-2 -mb-px ${
                  codeTab === 'code' ? 'text-ink border-brass' : 'text-slate border-transparent'
                }`}
              >
                Submitted code
              </button>
              <button
                type="button"
                onClick={() => setCodeTab('judge0')}
                className={`pb-3 text-sm font-bold border-b-2 -mb-px ${
                  codeTab === 'judge0' ? 'text-ink border-brass' : 'text-slate border-transparent'
                }`}
              >
                Judge0 results
              </button>
            </div>

            {codeTab === 'code' ? (
              <pre className="bg-ink text-paper text-xs font-mono rounded-xl p-5 overflow-x-auto whitespace-pre">
                {submission.submitted_code}
              </pre>
            ) : (
              <Card padded={false}>
                {testResults.map((test, index) => (
                  <div
                    key={test.name}
                    className={`flex items-center gap-3 px-5 py-3 ${
                      index !== testResults.length - 1 ? 'border-b border-slate/10' : ''
                    }`}
                  >
                    <span
                      className={`text-sm font-bold ${test.passed ? 'text-success' : 'text-red-500'}`}
                      aria-hidden="true"
                    >
                      {test.passed ? '✓' : '✕'}
                    </span>
                    <span className="text-sm text-ink flex-1">{test.name}</span>
                    <span className={`text-xs font-bold ${test.passed ? 'text-success' : 'text-red-500'}`}>
                      {test.passed ? 'Pass' : 'Fail'}
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {flags.length > 0 && (
          <div>
            <Card padded={false}>
              <h2 className="text-sm font-bold text-ink px-5 pt-5 pb-3">Integrity flags</h2>
              {flags.map((flag, index) => (
                <FlagRow key={index} flag={flag} />
              ))}
            </Card>
            <p className="text-xs text-slate mt-3">
              These flags inform your decision; they don't change the candidate's pass/fail
              result.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default CandidateDetail
