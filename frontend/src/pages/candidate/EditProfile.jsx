import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getMyProfile, patchMyProfile } from "../../api/profile";
import { getErrorMessage } from "../../api/errors";
import Header from "../../components/candidate/Header";
import Button from "../../components/shared/Button";
import Card from "../../components/shared/Card";

const SKILL_OPTIONS = [
  "Backend", "Frontend", "Full-stack", "DevOps", "Mobile",
  "Data / ML", "QA / Testing", "UI/UX Design",
];

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, setSession } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [resumeUrl, setResumeUrl] = useState(null);
  const [newResumeFile, setNewResumeFile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [initialSkills, setInitialSkills] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((profile) => {
        if (cancelled) return;
        setResumeUrl(profile.resume_url || null);
        setSkills(profile.skills || []);
        setInitialSkills(profile.skills || []);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your profile. Try refreshing.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleSkill(skill) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Resume must be a PDF file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Resume must be under 5MB.");
      return;
    }
    setError("");
    setNewResumeFile(file);
  }

  const skillsChanged =
    skills.length !== initialSkills.length ||
    skills.some((s) => !initialSkills.includes(s));

  async function handleSave() {
    if (!newResumeFile && !skillsChanged) {
      navigate("/dashboard");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const formData = new FormData();
      if (newResumeFile) formData.append("cv", newResumeFile);
      // Skills is a .set() on the backend, not an append — always send the
      // full current list when it's changed, not just what's new.
      if (skillsChanged) {
        skills.forEach((skill) => formData.append("skills", skill));
      }

      const profile = await patchMyProfile(formData);

      const token = localStorage.getItem("skillbridge_access_token");
      setSession({ ...user, ...profile }, token);

      setResumeUrl(profile.resume_url || null);
      setInitialSkills(profile.skills || []);
      setNewResumeFile(null);
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your changes. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper">
        <Header activeLink="Settings" />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-sm text-slate">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <Header activeLink="Settings" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold text-ink mb-1">Edit profile</h1>
        <p className="text-sm text-slate mb-8">
          Update your resume or the skills you're being matched on.
        </p>

        <Card className="mb-6">
          <h2 className="text-[11px] uppercase tracking-widelabel text-slate font-bold mb-4">
            Resume
          </h2>

          {resumeUrl && !newResumeFile && (
            
              <a href={resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-brass-dark hover:underline block mb-4"
            >
              View current resume ↗
            </a>
          )}

          <label
            htmlFor="resume"
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-8 px-6 cursor-pointer hover:border-brass hover:bg-brass-light/40 transition-colors text-center"
          >
            <span className="w-9 h-9 rounded-full bg-card flex items-center justify-center text-brass-dark font-bold">
              ↑
            </span>
            {newResumeFile ? (
              <span className="text-sm font-semibold text-ink">{newResumeFile.name}</span>
            ) : (
              <>
                <span className="text-sm font-semibold text-ink">
                  {resumeUrl ? "Replace resume" : "Upload a resume"}
                </span>
                <span className="text-xs text-slate">PDF, up to 5MB</span>
              </>
            )}
            <input
              id="resume"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </Card>

        <Card className="mb-6">
          <h2 className="text-[11px] uppercase tracking-widelabel text-slate font-bold mb-4">
            Skills
          </h2>
          <div className="flex flex-wrap gap-2">
            {SKILL_OPTIONS.map((skill) => {
              const active = skills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? "bg-ink text-white border-ink"
                      : "bg-surface text-ink border-line hover:border-brass"
                  }`}
                >
                  {skill}
                </button>
              );
            })}
          </div>
        </Card>

        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        {saved && !error && (
          <p className="text-success text-sm mb-4">Profile updated.</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button variant="default" onClick={() => navigate("/dashboard")} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" className="rounded-full" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}