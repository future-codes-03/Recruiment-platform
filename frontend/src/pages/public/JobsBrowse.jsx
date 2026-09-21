import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../../components/candidate/Header'
import { EmptyState } from '../../components/shared'
import { listPublicJobs } from '../../api/jobs'
import { getSkillCatalog } from '../../api/skills'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'most_slots', label: 'Most slots open' },
  { value: 'closest_to_filling', label: 'Closest to filling' },
]

// Small fixed palette, picked deterministically from the company name so the
// same company always gets the same avatar color — purely decorative, not
// derived from any real per-company data.
const AVATAR_COLORS = ['#1a1a2e', '#2a4a7a', '#1a3a2e', '#3a1a2e', '#2a3a1a', '#4a2a1a']
function avatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
function initialsFor(name) {
  const parts = name.trim().split(/\s+/)
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[1][0]).toUpperCase()
}

// created_at is real data from PublicJobSerializer — no field invented here.
function formatPostedDate(createdAt) {
  if (!createdAt) return null
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return `${months} month${months > 1 ? 's' : ''} ago`
}

function JobListingCard({ job }) {
  const company = job.company_name || job.title
  const openSlots = job.guaranteed_slots - job.slots_filled
  const pct = job.guaranteed_slots > 0 ? Math.round((openSlots / job.guaranteed_slots) * 100) : 0
  const slotColor = pct > 60 ? 'text-success' : pct > 30 ? 'text-landing-accent' : 'text-danger'
  const slotBarColor = pct > 60 ? 'bg-success' : pct > 30 ? 'bg-landing-accent' : 'bg-danger'
  const posted = formatPostedDate(job.created_at)

  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block rounded-2xl p-6 bg-landing-bg border border-landing-border transition-shadow hover:shadow-md hover:border-landing-text"
    >
      <div className="flex items-start gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ background: avatarColor(company) }}
        >
          {initialsFor(company)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h2 className="text-base font-semibold leading-snug text-landing-text">{job.title}</h2>
              {job.company_name && <p className="text-sm mt-0.5 text-landing-muted">{job.company_name}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {posted && <span className="hidden sm:block text-xs text-landing-muted">Posted {posted}</span>}
              <span className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-landing-accent-bg text-landing-accent whitespace-nowrap">
                View role →
              </span>
            </div>
          </div>

          {job.skill_requirements?.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3 mb-4">
              {job.skill_requirements.map((s) => (
                <span key={s.skill_name} className="px-2.5 py-0.5 rounded-full text-xs bg-landing-bg-alt border border-landing-border text-landing-dim">
                  {s.skill_name}
                </span>
              ))}
            </div>
          )}

          <div>
            <div className="h-1.5 rounded-full bg-landing-bg-alt">
              <div className={`h-full rounded-full transition-all ${slotBarColor}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-landing-muted">
                <span className={`font-semibold ${slotColor}`}>{openSlots}</span> of {job.guaranteed_slots} guaranteed slots still open
              </p>
              <p className={`text-xs font-medium ${slotColor}`}>{pct}% available</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

// Public browsing — reachable without an account (GET /public/jobs is
// unauthenticated per api_specification.yaml). Login is only required once
// a candidate actually starts an assessment, not to look at what's open.
function JobsBrowse() {
  const [jobs, setJobs] = useState(null) // null = still loading
  const [error, setError] = useState('')

  const [skillCatalog, setSkillCatalog] = useState([])
  // Backend filters by name, not id (?skill=<name>, case-insensitive) — see
  // PublicJobListView — so this holds a skill name, not a catalog id.
  const [skillFilter, setSkillFilter] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  useEffect(() => {
    getSkillCatalog().then(setSkillCatalog).catch(() => {
      // The filter just degrades to "All skills" only — not worth a
      // separate error state for a non-critical control.
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    setJobs(null)
    listPublicJobs({ skill: skillFilter || undefined })
      .then((data) => {
        if (!cancelled) setJobs(data.results)
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load open roles. Try refreshing.")
      })
    return () => {
      cancelled = true
    }
  }, [skillFilter])

  // Sorts only the currently-loaded page — the API has no sort param, only
  // a fixed newest-first order server-side. Fine at this scale; would need
  // a real backend sort param if listings grow past a page or two.
  const sortedJobs = useMemo(() => {
    if (!jobs) return jobs
    const withRemaining = jobs.map((j) => ({ ...j, _remaining: j.guaranteed_slots - j.slots_filled }))
    if (sortBy === 'most_slots') return [...withRemaining].sort((a, b) => b._remaining - a._remaining)
    if (sortBy === 'closest_to_filling') return [...withRemaining].sort((a, b) => a._remaining - b._remaining)
    return withRemaining
  }, [jobs, sortBy])

  const totalOpenSlots = jobs?.reduce((sum, j) => sum + (j.guaranteed_slots - j.slots_filled), 0) ?? 0
  const fullyOpenCount = jobs?.filter((j) => j.slots_filled === 0).length ?? 0

  return (
    <div className="min-h-screen bg-landing-bg-alt font-body">
      <Header activeLink="Jobs" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <p className="flex items-center gap-2 text-sm font-medium mb-3 text-landing-accent">
            <span className="w-2 h-2 rounded-full inline-block bg-landing-accent" />
            Open now
          </p>
          <h1 className="font-landing-display text-4xl font-bold mb-2 text-landing-text">
            Open roles with guaranteed slots.
          </h1>
          <p className="text-base text-landing-muted">
            Clear the published skill bar first, and the interview slot is locked in for you.
          </p>
        </div>

        {jobs && jobs.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { value: jobs.length, label: 'Open roles' },
              { value: totalOpenSlots, label: 'Available slots' },
              { value: fullyOpenCount, label: 'Fully open' },
            ].map(({ value, label }) => (
              <div key={label} className="rounded-2xl px-5 py-4 bg-landing-bg border border-landing-border">
                <p className="text-2xl font-bold mb-0.5 text-landing-text">{value}</p>
                <p className="text-xs text-landing-muted">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-landing-border rounded-xl px-3.5 py-2.5 text-sm bg-landing-bg text-landing-text focus:outline-none focus:border-landing-text cursor-pointer"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          <button
            type="button"
            onClick={() => setSkillFilter('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              skillFilter === '' ? 'bg-landing-text text-white border-landing-text' : 'bg-landing-bg text-landing-muted border-landing-border hover:border-landing-text hover:text-landing-text'
            }`}
          >
            All skills
          </button>
          {skillCatalog.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSkillFilter(s.name)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                skillFilter === s.name ? 'bg-landing-text text-white border-landing-text' : 'bg-landing-bg text-landing-muted border-landing-border hover:border-landing-text hover:text-landing-text'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {error && <p className="mb-6 text-danger text-sm">{error}</p>}

        {jobs === null && !error && (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl p-6 bg-landing-bg border border-landing-border animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-landing-border shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-landing-border rounded mb-2" />
                    <div className="h-3 w-28 bg-landing-border/70 rounded mb-4" />
                    <div className="h-2 w-full bg-landing-border/70 rounded-full mb-2" />
                    <div className="h-3 w-40 bg-landing-border/70 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {jobs?.length === 0 && (
          <div className="text-center py-20 text-landing-muted">
            <EmptyState
              title={skillFilter ? 'No roles match that skill' : 'No open roles right now'}
              message={
                skillFilter
                  ? 'Try a different skill, or check back soon for new postings.'
                  : 'Check back soon — new guaranteed-slot roles are posted regularly.'
              }
            />
            {skillFilter && (
              <button type="button" onClick={() => setSkillFilter('')} className="text-sm mt-2 text-landing-accent font-medium">
                Clear filters
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {sortedJobs?.map((job) => <JobListingCard key={job.id} job={job} />)}
        </div>

        {sortedJobs && sortedJobs.length > 0 && (
          <p className="text-center text-xs mt-8 text-landing-muted">
            Showing {sortedJobs.length} open {sortedJobs.length === 1 ? 'role' : 'roles'}
          </p>
        )}
      </div>
    </div>
  )
}

export default JobsBrowse
