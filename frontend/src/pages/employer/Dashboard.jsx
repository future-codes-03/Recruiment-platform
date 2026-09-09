import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../../components/employer/Header'
import { Card, ProgressBar, Button, EmptyState } from '../../components/shared'
import { listJobs } from '../../api/jobs'

function Dashboard() {
  const [jobs, setJobs] = useState(null) // null = still loading
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listJobs()
      .then((data) => {
        if (!cancelled) setJobs(data.results)
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your jobs. Try refreshing.")
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-paper">
      <Header activeLink="Jobs" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <h1 className="text-3xl font-bold text-ink">Jobs</h1>
          <Link to="/employer/jobs/new">
            <Button variant="primary">+ Create job</Button>
          </Link>
        </div>

        {error && (
          <Card className="mb-6 text-danger text-sm">{error}</Card>
        )}

        {jobs === null && !error && (
          <p className="text-sm text-slate">Loading jobs...</p>
        )}

        {jobs?.length === 0 && (
          <Card>
            <EmptyState
              title="No jobs yet"
              message="Create your first job to start building a candidate pipeline."
              actionLabel="+ Create job"
              actionTo="/employer/jobs/new"
            />
          </Card>
        )}

        <div className="flex flex-col gap-4">
          {jobs?.map((job) => (
            <Card key={job.id}>
              <div className="flex items-center justify-between gap-6">
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-ink mb-3">{job.title}</h2>
                  <ProgressBar value={job.slots_filled} max={job.guaranteed_slots} />
                  <p className="text-xs text-slate mt-1.5">
                    {job.slots_filled}/{job.guaranteed_slots} slots filled
                  </p>
                </div>
                <Link
                  to={`/employer/jobs/${job.id}`}
                  className="text-sm font-bold text-brass hover:underline whitespace-nowrap"
                >
                  Open
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
