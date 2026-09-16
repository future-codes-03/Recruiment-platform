import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../../components/candidate/Header'
import { Card, ProgressBar, Badge, EmptyState } from '../../components/shared'
import { listPublicJobs } from '../../api/jobs'
import { useAuth } from '../../context/AuthContext'

function Dashboard() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState(null) // null = still loading
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    // /public/jobs already excludes closed jobs server-side — no status
    // filter to pass, unlike the employer-scoped /jobs endpoint.
    listPublicJobs()
      .then((data) => {
        if (!cancelled) setJobs(data.results)
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load open roles. Try refreshing.")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hasResume = Boolean(user?.resume_url)

  return (
    <div className="min-h-screen bg-paper">
      <Header activeLink="Dashboard" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold text-ink mb-6">
          Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h1>

        {!hasResume && (
          <Card className="mb-8 flex flex-wrap items-center justify-between gap-4 bg-brass-light/50 border border-brass/30">
            <div>
              <p className="text-sm font-bold text-ink">Your profile is incomplete</p>
              <p className="text-xs text-slate mt-0.5">Upload a resume so employers can see who's behind a qualifying attempt.</p>
            </div>
            <Link to="/onboarding" className="text-sm font-bold text-brass-dark hover:underline whitespace-nowrap">
              Finish setup
            </Link>
          </Card>
        )}

        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-ink">Open roles with guaranteed slots</h2>
        </div>

        {error && <Card className="mb-6 text-danger text-sm">{error}</Card>}

        {jobs === null && !error && (
          <p className="text-sm text-slate">Loading open roles...</p>
        )}

        {jobs?.length === 0 && (
          <Card>
            <EmptyState
              title="No open roles right now"
              message="Check back soon — new guaranteed-slot roles are posted regularly."
            />
          </Card>
        )}

        <div className="flex flex-col gap-4">
          {jobs?.map((job) => (
            <Card key={job.id}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-base font-bold text-ink mb-2">{job.title}</h3>

                  {job.skill_requirements?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {job.skill_requirements.map((s) => (
                        <Badge key={s.skill_name}>{s.skill_name}</Badge>
                      ))}
                    </div>
                  )}

                  <ProgressBar value={job.slots_filled} max={job.guaranteed_slots} />
                  <p className="text-xs text-slate mt-1.5">
                    {job.guaranteed_slots - job.slots_filled} of {job.guaranteed_slots} guaranteed slots still open
                  </p>
                </div>
                <Link
                  to={`/jobs/${job.id}`}
                  className="text-sm font-bold text-brass hover:underline whitespace-nowrap sm:self-start"
                >
                  View role
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
