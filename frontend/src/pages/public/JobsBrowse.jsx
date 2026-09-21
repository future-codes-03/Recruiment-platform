import { useEffect, useMemo, useState } from 'react'
import Header from '../../components/candidate/Header'
import JobCard from '../../components/candidate/JobCard'
import { Card, EmptyState, JobCardSkeleton } from '../../components/shared'
import { listPublicJobs } from '../../api/jobs'
import { getSkillCatalog } from '../../api/skills'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'most_slots', label: 'Most slots open' },
  { value: 'closest_to_filling', label: 'Closest to filling' },
]

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

  return (
    <div className="min-h-screen bg-paper">
      <Header activeLink="Jobs" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold text-ink mb-1">Open roles with guaranteed slots</h1>
        <p className="text-sm text-slate mb-8">
          Clear the published skill bar first, and the interview slot is locked in for you.
        </p>

        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="border border-line rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-brass"
          >
            <option value="">All skills</option>
            {skillCatalog.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-line rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-brass"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {error && <Card className="mb-6 text-danger text-sm">{error}</Card>}

        {jobs === null && !error && (
          <div className="flex flex-col gap-4">
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
          </div>
        )}

        {jobs?.length === 0 && (
          <Card>
            <EmptyState
              title={skillFilter ? 'No roles match that skill' : 'No open roles right now'}
              message={
                skillFilter
                  ? 'Try a different skill, or check back soon for new postings.'
                  : 'Check back soon — new guaranteed-slot roles are posted regularly.'
              }
            />
          </Card>
        )}

        <div className="flex flex-col gap-4">
          {sortedJobs?.map((job) => <JobCard key={job.id} job={job} />)}
        </div>
      </div>
    </div>
  )
}

export default JobsBrowse