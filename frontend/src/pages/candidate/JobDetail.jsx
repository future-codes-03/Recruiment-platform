import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Header from '../../components/candidate/Header'
import { Card, ProgressBar, Badge, Button, EmptyState } from '../../components/shared'
import { getPublicJob } from '../../api/jobs'
import { useAuth } from '../../context/AuthContext'

function JobDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    getPublicJob(id)
      .then((data) => {
        if (!cancelled) setJob(data)
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
        <p className="text-sm text-slate">Loading role...</p>
      </div>
    )
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <EmptyState
          title="Role not found"
          message="This role may have closed, or the link is out of date."
          actionLabel="Back to open roles"
          actionTo="/jobs"
        />
      </div>
    )
  }

  const slotsOpen = job.guaranteed_slots - job.slots_filled

  return (
    <div className="min-h-screen bg-paper">
      <Header activeLink="Jobs" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/jobs" className="text-xs font-bold text-slate hover:text-ink">← Back to open roles</Link>

        <h1 className="text-2xl sm:text-3xl font-bold text-ink mt-4 mb-1">{job.title}</h1>
        <p className="text-sm text-slate mb-6">
          {slotsOpen > 0
            ? `${slotsOpen} of ${job.guaranteed_slots} guaranteed slots still open`
            : 'All guaranteed slots for this role have been claimed'}
        </p>

        <Card className="mb-6">
          <ProgressBar
            value={job.slots_filled}
            max={job.guaranteed_slots}
            label="Guaranteed slots claimed"
            showValue
          />
        </Card>

        <Card className="mb-6">
          <h2 className="text-[11px] uppercase tracking-widelabel text-slate font-bold mb-4">
            Skill bar for this role
          </h2>
          <p className="text-xs text-slate mb-4">
            Clear every minimum below to qualify for a guaranteed interview.
          </p>
          <div className="flex flex-col gap-3">
            {job.skill_requirements?.map((s) => (
              <div key={s.skill_name} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Badge>{s.skill_name}</Badge>
                  <span className="text-xs text-slate">{s.weight_pct}% weight</span>
                </div>
                <span className="text-xs font-bold text-ink">min {s.min_score}%</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex justify-end">
          <Link to={user ? `/jobs/${job.id}/assessment` : `/signup?as=candidate`}>
            <Button variant="primary" className="rounded-full" disabled={slotsOpen <= 0}>
              {slotsOpen > 0
                ? user
                  ? 'Start assessment — PKR 100'
                  : 'Sign up to start — PKR 100'
                : 'Slots full'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default JobDetail
