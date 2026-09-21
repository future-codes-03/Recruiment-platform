import { Link } from 'react-router-dom'
import { Card, ProgressBar, Badge } from '../shared'

// created_at is real data from PublicJobSerializer — no field invented here.
function formatPostedDate(createdAt) {
  if (!createdAt) return null
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
  if (days <= 0) return 'Posted today'
  if (days === 1) return 'Posted yesterday'
  if (days < 30) return `Posted ${days} days ago`
  const months = Math.floor(days / 30)
  return `Posted ${months} month${months > 1 ? 's' : ''} ago`
}

function JobCard({ job }) {
  const slotsOpen = job.guaranteed_slots - job.slots_filled
  const posted = formatPostedDate(job.created_at)

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3 mb-0.5">
            <h3 className="text-base font-bold text-ink">{job.title}</h3>
            {posted && (
              <span className="text-[11px] text-slate/70 whitespace-nowrap shrink-0 mt-0.5">{posted}</span>
            )}
          </div>
          {job.company_name && (
            <p className="text-xs text-slate mb-2">{job.company_name}</p>
          )}

          {job.skill_requirements?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {job.skill_requirements.map((s) => (
                <Badge key={s.skill_name}>{s.skill_name}</Badge>
              ))}
            </div>
          )}

          {/* ProgressBar auto-colors by fill level now (see ProgressBar.jsx) */}
          <ProgressBar value={job.slots_filled} max={job.guaranteed_slots} />
          <p className="text-xs text-slate mt-1.5">
            {slotsOpen} of {job.guaranteed_slots} guaranteed slots still open
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
  )
}

export default JobCard