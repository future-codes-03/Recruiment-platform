import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Header from '../../components/candidate/Header'
import { EmptyState } from '../../components/shared'
import { getPublicJob } from '../../api/jobs'
import { useAuth } from '../../context/AuthContext'

const SENIORITY_LABELS = {
  intern: 'Intern',
  'entry level': 'Entry Level',
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
}

function initialsFor(name) {
  const parts = name.trim().split(/\s+/)
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[1][0]).toUpperCase()
}

// Mirrors JobsBrowse.jsx's formatPostedDate — created_at is real data from
// PublicJobSerializer.
function formatPostedDate(createdAt) {
  if (!createdAt) return null
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return `${months} month${months > 1 ? 's' : ''} ago`
}

function SkillRow({ skill_name, weight_pct, min_score }) {
  return (
    <div className="rounded-xl p-4 bg-landing-bg-alt border border-landing-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-landing-text text-white">{skill_name}</span>
          <span className="text-xs text-landing-muted">{weight_pct}% weight</span>
        </div>
        <span className="text-xs font-bold text-landing-text">min {min_score}%</span>
      </div>

      <div className="mb-2">
        <div className="h-2 rounded-full bg-landing-border">
          <div className="h-full rounded-full bg-landing-text" style={{ width: `${weight_pct}%` }} />
        </div>
        <p className="text-xs mt-1 text-landing-muted">Contribution to overall score</p>
      </div>

      <div>
        <div className="h-1.5 rounded-full bg-landing-border">
          <div className="h-full rounded-full bg-landing-accent" style={{ width: `${min_score}%` }} />
        </div>
        <p className="text-xs mt-1 font-semibold text-landing-accent">You must score at least {min_score}% on this skill</p>
      </div>
    </div>
  )
}

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
      <div className="min-h-screen bg-landing-bg-alt flex items-center justify-center">
        <p className="text-sm text-landing-muted">Loading role...</p>
      </div>
    )
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen bg-landing-bg-alt flex items-center justify-center">
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
  const slotPct = Math.round((job.slots_filled / job.guaranteed_slots) * 100)
  const urgency = slotsOpen <= 2 ? 'high' : slotsOpen <= 5 ? 'medium' : 'low'
  const urgencyClasses = {
    low: { text: 'text-success', bg: 'bg-success-bg', bar: 'bg-success' },
    medium: { text: 'text-landing-accent', bg: 'bg-landing-accent-bg', bar: 'bg-landing-accent' },
    high: { text: 'text-danger', bg: 'bg-danger-bg', bar: 'bg-danger' },
  }[urgency]
  const urgencyLabel = { low: 'Plenty available', medium: 'Filling up', high: 'Almost full' }[urgency]

  const company = job.company_name || job.title
  const posted = formatPostedDate(job.created_at)
  const seniorityLabel = SENIORITY_LABELS[job.seniority] || job.seniority

  return (
    <div className="min-h-screen bg-landing-bg-alt font-body">
      <Header activeLink="Jobs" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/jobs" className="flex items-center gap-1.5 text-sm mb-6 text-landing-muted hover:text-landing-text transition-colors w-fit">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to open roles
        </Link>

        <div className="flex flex-col lg:flex-row gap-7 items-start">
          {/* Left: main content */}
          <div className="flex-1 min-w-0 flex flex-col gap-6 w-full">
            {/* Hero card */}
            <div className="rounded-2xl p-7 bg-landing-bg border border-landing-border">
              <div className="flex items-start gap-5">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-base font-bold shrink-0 bg-landing-text text-white"
                >
                  {initialsFor(company)}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="font-landing-display text-3xl font-bold mb-1 text-landing-text">{job.title}</h1>
                  {job.company_name && <p className="text-sm mb-3 text-landing-muted">{job.company_name}</p>}
                  <div className="flex flex-wrap gap-2">
                    {seniorityLabel && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-landing-card text-landing-dim">
                        {seniorityLabel}
                      </span>
                    )}
                    {posted && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-landing-bg-alt border border-landing-border text-landing-muted">
                        <svg className="inline mr-1" width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" strokeLinecap="round" />
                        </svg>
                        Posted {posted}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* About the role */}
            {job.description && (
              <div className="rounded-2xl p-7 bg-landing-bg border border-landing-border">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-landing-accent-bg text-landing-accent shrink-0">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-landing-muted">About the role</p>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line text-landing-dim">{job.description}</p>
              </div>
            )}

            {/* Skill bar */}
            <div className="rounded-2xl p-7 bg-landing-bg border border-landing-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-landing-accent-bg text-landing-accent shrink-0">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-landing-muted">Skill bar for this role</p>
              </div>
              <p className="text-sm mb-6 text-landing-muted">
                Clear every minimum below to qualify for a guaranteed interview.
                {job.overall_min_score != null && ` You'll also need an overall score of at least ${job.overall_min_score}% across all skills combined.`}
              </p>
              <div className="flex flex-col gap-4">
                {job.skill_requirements?.map((s) => <SkillRow key={s.skill_name} {...s} />)}
              </div>
            </div>
          </div>

          {/* Right: sticky sidebar */}
          <div className="lg:w-80 shrink-0 w-full flex flex-col gap-5 lg:sticky lg:top-24">
            {/* Slots card */}
            <div className="rounded-2xl p-6 bg-landing-bg border border-landing-border">
              <p className="text-xs font-semibold uppercase tracking-widest mb-4 text-landing-muted">Guaranteed slots</p>

              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className={`text-3xl font-bold ${urgencyClasses.text}`}>{slotsOpen}</p>
                  <p className="text-xs text-landing-muted">of {job.guaranteed_slots} still open</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${urgencyClasses.bg} ${urgencyClasses.text}`}>
                  ● {urgencyLabel}
                </span>
              </div>

              <div className="h-2.5 rounded-full mb-2 bg-landing-border">
                <div className={`h-full rounded-full transition-all ${urgencyClasses.bar}`} style={{ width: `${slotPct}%` }} />
              </div>
              <p className="text-xs text-landing-muted">
                {job.slots_filled} of {job.guaranteed_slots} slots claimed
              </p>
            </div>

            {/* Assessment CTA card */}
            <div className="rounded-2xl p-6 bg-landing-text">
              <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-landing-dark-muted">Your path in</p>
              <p className="font-landing-display text-lg font-bold mb-1 text-white">Start the assessment</p>
              <p className="text-xs mb-5 leading-relaxed text-landing-dark-muted">
                Clear every skill bar and your interview slot is guaranteed — no recruiter call needed.
              </p>

              <ul className="flex flex-col gap-2 mb-6">
                {[
                  'Every skill minimum, clearly published',
                  'No resume screening, ever',
                  'First to qualify locks the slot',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-xs text-gray-300">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 bg-landing-accent">
                      <svg width="8" height="8" fill="none" viewBox="0 0 10 10">
                        <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <Link to={user ? `/jobs/${job.id}/assessment` : `/signup?as=candidate`}>
                <button
                  type="button"
                  disabled={slotsOpen <= 0}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 bg-landing-accent text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {slotsOpen > 0
                    ? user
                      ? 'Start assessment — PKR 100'
                      : 'Sign up to start — PKR 100'
                    : 'Slots full'}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default JobDetail
