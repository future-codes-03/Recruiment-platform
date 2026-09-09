import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../../components/employer/Header'
import { Card, Button } from '../../components/shared'
import { getCompanyProfile, updateCompanyProfile } from '../../api/company'

function Settings() {
  const fileInputRef = useRef(null)
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCompanyProfile()
      .then((data) => !cancelled && setCompanyName(data.name))
      .catch(() => !cancelled && setError("Couldn't load your company profile."))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await updateCompanyProfile({ name: companyName })
      setSaved(true)
    } catch {
      setError("Couldn't save changes. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <Header activeLink="Settings" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <h1 className="text-3xl font-bold text-ink">Settings</h1>
          <Link to="/employer/billing" className="text-sm font-bold text-brass hover:underline">
            Payment activity →
          </Link>
        </div>

        {error && (
          <div className="bg-danger-bg text-danger text-sm rounded-md px-4 py-3 mb-6">{error}</div>
        )}
        {saved && (
          <div className="bg-success-bg text-success text-sm rounded-md px-4 py-3 mb-6">Saved.</div>
        )}

        <h2 className="text-[11px] uppercase tracking-widelabel text-slate font-bold mb-3">
          Company profile
        </h2>
        <Card className="mb-8">
          <div className="flex flex-col gap-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widelabel text-slate font-bold mb-2">
                Company name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={loading}
                className="w-full max-w-sm rounded-lg border border-slate/30 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brass disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widelabel text-slate font-bold mb-2">
                Logo
              </label>
              {/* No file-upload endpoint exists anywhere in the spec yet —
                  left disabled rather than silently pretending this works. */}
              <Button
                variant="default"
                disabled
                title="Not available yet — no upload endpoint in the API yet"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload (coming soon)
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
            </div>
          </div>
        </Card>

        <h2 className="text-[11px] uppercase tracking-widelabel text-slate font-bold mb-3">
          Team members
        </h2>
        <Card className="mb-8">
          {/* No invite/recruiter-management endpoint exists anywhere in the
              spec yet — same reasoning as the logo upload above. */}
          <Button variant="default" disabled title="Not available yet — no invite endpoint in the API yet">
            + Invite teammate (coming soon)
          </Button>
        </Card>

        <div className="flex justify-end">
          <Button variant="primary" disabled={loading || saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Settings
