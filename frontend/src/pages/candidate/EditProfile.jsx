import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getMyProfile, patchMyProfile, deleteMyResume, deleteMyPhone } from "../../api/profile";
import { getSkillCatalog } from "../../api/skills";
import { getErrorMessage } from "../../api/errors";
import Header from "../../components/candidate/Header";
import Button from "../../components/shared/Button";
import Card from "../../components/shared/Card";

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, setSession } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [initialFullName, setInitialFullName] = useState("");
  const [initialPhone, setInitialPhone] = useState("");

  const [resumeUrl, setResumeUrl] = useState(null);
  const [newResumeFile, setNewResumeFile] = useState(null);
  const [confirmingResumeDelete, setConfirmingResumeDelete] = useState(false);
  const [deletingResume, setDeletingResume] = useState(false);

  const [confirmingPhoneDelete, setConfirmingPhoneDelete] = useState(false);
  const [deletingPhone, setDeletingPhone] = useState(false);

  const [skillCatalog, setSkillCatalog] = useState([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState([]);
  const [initialSkillIds, setInitialSkillIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyProfile(), getSkillCatalog()])
      .then(([profile, catalog]) => {
        if (cancelled) return;
        setResumeUrl(profile.resume_url || null);
        setFullName(profile.full_name || "");
        setInitialFullName(profile.full_name || "");
        setPhone(profile.phone || "");
        setInitialPhone(profile.phone || "");
        const ids = (profile.skills || []).map((s) => s.id);
        setSelectedSkillIds(ids);
        setInitialSkillIds(ids);
        setSkillCatalog(catalog);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your profile. Try refreshing.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleSkill(id) {
    setSelectedSkillIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
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

  function applyProfile(profile) {
    const token = localStorage.getItem("skillbridge_access_token");
    setSession({ ...user, ...profile }, token);
    setResumeUrl(profile.resume_url || null);
    setPhone(profile.phone || "");
    setInitialPhone(profile.phone || "");
  }

  async function handleDeleteResume() {
    setDeletingResume(true);
    setError("");
    try {
      const profile = await deleteMyResume();
      applyProfile(profile);
      setConfirmingResumeDelete(false);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't remove your resume. Please try again."));
    } finally {
      setDeletingResume(false);
    }
  }

  async function handleDeletePhone() {
    setDeletingPhone(true);
    setError("");
    try {
      const profile = await deleteMyPhone();
      applyProfile(profile);
      setConfirmingPhoneDelete(false);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't remove your phone number. Please try again."));
    } finally {
      setDeletingPhone(false);
    }
  }

  const skillsChanged =
    selectedSkillIds.length !== initialSkillIds.length ||
    selectedSkillIds.some((id) => !initialSkillIds.includes(id));
  const nameChanged = fullName.trim() !== initialFullName;
  const phoneChanged = phone.trim() !== initialPhone;

  async function handleSave() {
    if (!newResumeFile && !skillsChanged && !nameChanged && !phoneChanged) {
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
      // full current selection when it's changed, not just what's new.
      if (skillsChanged) {
        selectedSkillIds.forEach((id) => formData.append("skills", id));
      }
      if (nameChanged) formData.append("full_name", fullName.trim());
      // Clearing the phone field to blank and saving here would just error
      // — the backend rejects a blank phone on PATCH. Use "Remove" instead.
      if (phoneChanged && phone.trim()) formData.append("phone", phone.trim());

      const profile = await patchMyProfile(formData);

      applyProfile(profile);
      setInitialFullName(profile.full_name || "");
      const ids = (profile.skills || []).map((s) => s.id);
      setSelectedSkillIds(ids);
      setInitialSkillIds(ids);
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
          Update your details, resume, or the skills you're being matched on.
        </p>

        <Card className="mb-6">
          <h2 className="text-[11px] uppercase tracking-widelabel text-slate font-bold mb-4">
            Account details
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="text-xs font-semibold text-slate uppercase tracking-wide block mb-1.5">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-line px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-brass"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="editPhone" className="text-xs font-semibold text-slate uppercase tracking-wide">
                  Phone number
                </label>
                {initialPhone && !confirmingPhoneDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmingPhoneDelete(true)}
                    className="text-xs font-medium text-danger hover:underline"
                  >
                    Remove
                  </button>
                )}
                {confirmingPhoneDelete && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate">Remove your phone number?</span>
                    <button
                      type="button"
                      onClick={handleDeletePhone}
                      disabled={deletingPhone}
                      className="text-xs font-semibold text-danger hover:underline disabled:opacity-50"
                    >
                      {deletingPhone ? "Removing..." : "Confirm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingPhoneDelete(false)}
                      disabled={deletingPhone}
                      className="text-xs font-medium text-slate hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <input
                id="editPhone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 03xx xxxxxxx"
                className="w-full rounded-lg border border-line px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-brass"
              />
            </div>
          </div>
        </Card>

        <Card className="mb-6">
          <h2 className="text-[11px] uppercase tracking-widelabel text-slate font-bold mb-4">
            Resume
          </h2>

          {resumeUrl && !newResumeFile && (
            <div className="flex items-center justify-between mb-4">
              <a
                href={resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-brass-dark hover:underline"
              >
                View current resume ↗
              </a>

              {!confirmingResumeDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmingResumeDelete(true)}
                  className="text-sm font-medium text-danger hover:underline"
                >
                  Remove
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate">Remove your resume?</span>
                  <button
                    type="button"
                    onClick={handleDeleteResume}
                    disabled={deletingResume}
                    className="text-sm font-semibold text-danger hover:underline disabled:opacity-50"
                  >
                    {deletingResume ? "Removing..." : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingResumeDelete(false)}
                    disabled={deletingResume}
                    className="text-sm font-medium text-slate hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
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
            {skillCatalog.map((skill) => {
              const active = selectedSkillIds.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? "bg-ink text-white border-ink"
                      : "bg-surface text-ink border-line hover:border-brass"
                  }`}
                >
                  {skill.name}
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