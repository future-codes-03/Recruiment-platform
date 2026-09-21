import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../../components/candidate/Header'
import JobCard from '../../components/candidate/JobCard'
import { Card, EmptyState, JobCardSkeleton } from '../../components/shared'
import { listPublicJobs, listMatchedJobs } from '../../api/jobs'
import { useAuth } from '../../context/AuthContext'

function Dashboard() {
  const { user } = useAuth()
  const hasSkills = Boolean(user?.skills?.length)
  const profileIncomplete = !user?.profile_complete

  const [jobs, setJobs] = useState(null) // null = still loading
  const [error, setError] = useState('')

  const [matchedJobs, setMatchedJobs] = useState(null)
  const [matchedError, setMatchedError] = useState('')

  useEffect(() => {
    let cancelled = false
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

  useEffect(() => {
    if (!hasSkills) return
    let cancelled = false
    listMatchedJobs()
      .then((data) => {
        if (!cancelled) setMatchedJobs(data.results)
      })
      .catch(() => {
        if (!cancelled) setMatchedError("Couldn't load matched roles.")
      })
    return () => {
      cancelled = true
    }
  }, [hasSkills])

  return (
    <div className="min-h-screen bg-landing-bg-alt font-body">
      <Header activeLink="Dashboard" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-landing-display text-3xl font-bold text-landing-text mb-6">
          Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h1>

        {profileIncomplete && (
          <Card className="mb-8 flex flex-wrap items-center justify-between gap-4 bg-landing-accent-bg border border-landing-accent/25">
            <div>
              <p className="text-sm font-bold text-landing-text">Your profile is incomplete</p>
              <p className="text-xs text-landing-muted mt-0.5">Finish setting up your profile so employers have what they need and you don't miss a guaranteed slot.</p>
            </div>
            <Link to="/onboarding" className="text-sm font-bold text-landing-accent hover:underline whitespace-nowrap">
              Finish setup
            </Link>
          </Card>
        )}

        {hasSkills && (
          <div className="mb-10">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-landing-display text-lg font-bold text-landing-text">Matched to your skills</h2>
            </div>

            {matchedError && <Card className="mb-6 bg-danger-bg text-danger text-sm">{matchedError}</Card>}

            {matchedJobs === null && !matchedError && (
              <div className="flex flex-col gap-4">
                <JobCardSkeleton />
                <JobCardSkeleton />
              </div>
            )}

            {matchedJobs?.length === 0 && (
              <Card className="bg-landing-bg border border-landing-border">
                <EmptyState
                  title="No matches yet"
                  message="Nothing published right now matches your skills — check back soon, or browse everything below."
                />
              </Card>
            )}

            <div className="flex flex-col gap-4">
              {matchedJobs?.map((job) => <JobCard key={job.id} job={job} />)}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-landing-display text-lg font-bold text-landing-text">All open roles</h2>
        </div>

        {error && <Card className="mb-6 bg-danger-bg text-danger text-sm">{error}</Card>}

        {jobs === null && !error && (
          <div className="flex flex-col gap-4">
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
          </div>
        )}

        {jobs?.length === 0 && (
          <Card className="bg-landing-bg border border-landing-border">
            <EmptyState
              title="No open roles right now"
              message="Check back soon — new guaranteed-slot roles are posted regularly."
            />
          </Card>
        )}

        <div className="flex flex-col gap-4">
          {jobs?.map((job) => <JobCard key={job.id} job={job} />)}
        </div>
      </div>
    </div>
  )
}

export default Dashboard