import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card, Button } from '../../components/shared'
import { getJob, createJob, updateJob, publishJob } from '../../api/jobs'
import { getErrorMessage } from '../../api/errors'

const QUALIFICATION_RULES = [
  { value: 'all', label: 'All thresholds must pass' },
  { value: 'weighted', label: 'Weighted average must pass' },
]

const DEFAULT_SKILLS = [
  { name: 'React', weight: 40, minScore: 70 },
  { name: 'JavaScript', weight: 35, minScore: 70 },
  { name: 'CSS', weight: 25, minScore: 70 },
]

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m12 2 2.9 6.6L22 9.6l-5 4.9 1.2 7L12 18.1 5.8 21.5 7 14.5l-5-4.9 7.1-1L12 2Z" />
    </svg>
  )
}

function JobForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [slots, setSlots] = useState(1)
  const [skills, setSkills] = useState(DEFAULT_SKILLS)
  const [rule, setRule] = useState('weighted')

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    getJob(id)
      .then((job) => {
        if (cancelled) return
        setTitle(job.title)
        setSlots(job.guaranteed_slots)
        setSkills(
          job.skill_requirements.map((s) => ({
            name: s.skill_name,
            weight: s.weight_pct,
            minScore: s.min_score,
          })),
        )
        setRule(job.qualification_rule ?? 'weighted')
      })
      .catch(() => !cancelled && setError("Couldn't load this job."))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id, isEdit])

  const total = skills.reduce((sum, skill) => sum + Number(skill.weight || 0), 0)
  const isBalanced = total === 100

  const updateSkillWeight = (index, weight) => {
    setSkills((prev) =>
      prev.map((skill, i) => (i === index ? { ...skill, weight: Number(weight) } : skill)),
    )
  }

  const updateSkillMinScore = (index, minScore) => {
    setSkills((prev) =>
      prev.map((skill, i) => (i === index ? { ...skill, minScore: Number(minScore) } : skill)),
    )
  }

  const updateSkillName = (index, name) => {
    setSkills((prev) => prev.map((skill, i) => (i === index ? { ...skill, name } : skill)))
  }

  const removeSkill = (index) => {
    setSkills((prev) => prev.filter((_, i) => i !== index))
  }

  const addSkill = () => {
    setSkills((prev) => [...prev, { name: '', weight: 0, minScore: 70 }])
  }

  const handleSubmit = async (status) => {
    setError('')
    setSaving(true)
    const payload = {
      title,
      guaranteed_slots: Number(slots),
      qualification_rule: rule, // PROPOSED field — see api_specification.yaml
      skill_requirements: skills.map((s) => ({
        skill_name: s.name,
        weight_pct: Number(s.weight),
        min_score: Number(s.minScore),
      })),
    }

    try {
      const job = isEdit ? await updateJob(id, payload) : await createJob(payload)

      if (status === 'draft') {
        navigate('/employer/dashboard')
        return
      }

      // Publishing is a separate call, and per the spec it's rejected until
      // the guarantee agreement is accepted and the company is verified —
      // neither of which this form has a step for yet. Rather than silently
      // pretending to accept a legal agreement on the employer's behalf, we
      // surface the real error if the backend rejects it.
      await publishJob(job.id)
      navigate('/employer/dashboard')
    } catch (err) {
      const code = err.response?.data?.error_code
      if (code === 'ERR_GUARANTEE_NOT_ACCEPTED') {
        setError(
          'Saved as draft. Publishing needs the Employer Guarantee Agreement accepted first — that screen isn\'t built yet.',
        )
      } else if (code === 'ERR_COMPANY_NOT_VERIFIED') {
        setError('Saved as draft. Your company needs to finish verification before you can publish.')
      } else {
        setError(getErrorMessage(err, 'Something went wrong saving this job.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const backTo = isEdit ? `/employer/jobs/${id}` : '/employer/dashboard'
  const backLabel = isEdit ? '← Back to job' : '← Back to jobs'

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-sm text-slate">Loading job...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="bg-ink px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Link to={backTo} className="text-sm font-bold text-white/70 hover:text-white">
            {backLabel}
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold text-ink mb-8">{isEdit ? 'Edit job' : 'New job'}</h1>

        {error && (
          <div className="bg-danger-bg text-danger text-sm rounded-md px-4 py-3 mb-6">{error}</div>
        )}

        <Card>
          <div className="flex flex-col gap-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widelabel text-slate font-bold mb-2">
                Role title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Frontend Engineer"
                className="w-full rounded-lg border border-slate/30 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brass"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widelabel text-slate font-bold mb-2">
                Guaranteed slots
              </label>
              <input
                type="number"
                min="1"
                value={slots}
                onChange={(e) => setSlots(e.target.value)}
                className="w-32 rounded-lg border border-slate/30 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brass"
              />
            </div>

            <div className="bg-brass/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4 text-ink">
                <StarIcon />
                <span className="text-sm font-bold">
                  Suggested weightings — review before saving
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {skills.map((skill, index) => (
                  <div key={index} className="flex items-center gap-3 flex-wrap">
                    <input
                      type="text"
                      value={skill.name}
                      onChange={(e) => updateSkillName(index, e.target.value)}
                      placeholder="Skill name"
                      className="w-36 rounded-lg border border-slate/30 bg-white px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brass"
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={skill.weight}
                      onChange={(e) => updateSkillWeight(index, e.target.value)}
                      className="flex-1 min-w-24 accent-brass"
                    />
                    <span className="w-12 text-sm font-bold text-ink text-right">
                      {skill.weight}%
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-slate">
                      min score
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={skill.minScore}
                        onChange={(e) => updateSkillMinScore(index, e.target.value)}
                        className="w-14 rounded border border-slate/30 bg-white px-1.5 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brass"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeSkill(index)}
                      aria-label={`Remove ${skill.name || 'skill'}`}
                      className="text-slate hover:text-ink text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addSkill}
                className="mt-4 text-sm font-bold text-brass hover:underline"
              >
                + add skill
              </button>

              <div className="mt-4 pt-4 border-t border-ink/10 flex items-center justify-between">
                <span className="text-xs font-bold text-ink">Total weighting</span>
                <span className={`text-sm font-bold ${isBalanced ? 'text-success' : 'text-orange-600'}`}>
                  {total}%
                </span>
              </div>
              {!isBalanced && (
                <p className="text-xs text-orange-600 mt-1">
                  Weightings should sum to 100% (currently {total}%).
                </p>
              )}
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widelabel text-slate font-bold mb-2">
                Qualification rule
              </label>
              <select
                value={rule}
                onChange={(e) => setRule(e.target.value)}
                className="w-full rounded-lg border border-slate/30 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brass"
              >
                {QUALIFICATION_RULES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between mt-6">
          <Button variant="default" disabled={saving} onClick={() => handleSubmit('draft')}>
            {saving ? 'Saving...' : 'Save as draft'}
          </Button>
          <Button variant="primary" disabled={saving} onClick={() => handleSubmit('published')}>
            {saving ? 'Saving...' : 'Publish job'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default JobForm
