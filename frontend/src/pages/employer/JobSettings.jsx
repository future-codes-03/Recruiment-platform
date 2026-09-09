import { useEffect, useState } from 'react'
import { Card, EmptyState } from '../../components/shared'
import { getJob } from '../../api/jobs'
import JobPipelineHeader from './job/JobPipelineHeader'
import { useParams } from 'react-router-dom'

function JobSettings() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    getJob(id)
      .then((data) => !cancelled && setJob(data))
      .catch((err) => !cancelled && err.response?.status === 404 && setNotFound(true))
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
      <JobPipelineHeader job={job} activeTab="settings" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-10 pt-8">
        <Card>
          <p className="text-sm text-slate">
            Weightings, qualification rule, and visibility controls for this job will live
            here. For now, edit those from the job's Edit screen.
          </p>
        </Card>
      </div>
    </div>
  )
}

export default JobSettings
