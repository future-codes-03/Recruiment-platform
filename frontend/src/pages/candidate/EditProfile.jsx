import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getMyProfile, patchMyProfile, deleteMyResume, deleteMyPhone } from "../../api/profile";
import { getSkillCatalog } from "../../api/skills";
import { getErrorMessage } from "../../api/errors";
import Header from "../../components/candidate/Header";

// Mirrors components/candidate/Header.jsx's avatar initials logic.
function getInitials(fullName) {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SECTIONS = [
  {
    id: "profile",
    label: "Profile",
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: "resume",
    label: "Resume",
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "skills",
    label: "Skills",
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

// The section card wrapper used by every tab — icon + eyebrow label, then content.
function SectionCard({ icon, label, children }) {
  return (
    <div className="rounded-2xl p-7 bg-landing-bg border border-landing-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-landing-accent-bg text-landing-accent shrink-0">
          {icon}
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-landing-muted">{label}</p>
      </div>
      {children}
    </div>
  );
}

// Same save/cancel action bar under whichever section is active — both
// buttons run the same handleSave/navigate that already covers every field
// on the page, so saving from any tab saves everything pending.
function SaveBar({ onSave, onCancel, saving }) {
  return (
    <div className="rounded-2xl px-6 py-4 flex items-center justify-between bg-landing-bg border border-landing-border">
      <p className="text-sm text-landing-muted">Unsaved changes will be lost</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-sm font-medium px-4 py-2 rounded-lg text-landing-muted hover:text-landing-text disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="text-sm font-semibold px-5 py-2 rounded-lg bg-landing-text text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes →"}
        </button>
      </div>
    </div>
  );
}

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, setSession } = useAuth();
  const { showToast } = useToast();

  const [activeSection, setActiveSection] = useState("profile");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      showToast("Resume removed.");
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
      showToast("Phone number removed.");
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
      showToast("Profile updated.");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your changes. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    navigate("/dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-landing-bg-alt font-body">
        <Header activeLink="Settings" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-sm text-landing-muted">Loading your profile...</p>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-landing-border px-3.5 py-2.5 text-sm bg-landing-bg text-landing-text focus:outline-none focus:border-landing-text transition-colors";

  return (
    <div className="min-h-screen bg-landing-bg-alt font-body">
      <Header activeLink="Settings" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="font-landing-display text-3xl font-bold mb-1 text-landing-text">Edit profile</h1>
          <p className="text-sm text-landing-muted">
            Update your details, resume, or the skills you're being matched on.
          </p>
        </div>

        {error && <p className="text-danger text-sm mb-6">{error}</p>}

        <div className="flex flex-col lg:flex-row gap-7">
          {/* Sidebar */}
          <aside className="lg:w-56 shrink-0">
            <div className="rounded-2xl overflow-hidden bg-landing-bg border border-landing-border">
              <div className="flex flex-col items-center py-7 px-5 border-b border-landing-border-sub">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold mb-3 bg-landing-text text-white">
                  {getInitials(fullName)}
                </div>
                <p className="text-sm font-semibold text-landing-text">{fullName || "Your profile"}</p>
                <p className="text-xs mt-0.5 text-landing-muted">Candidate</p>
              </div>

              <nav className="p-2">
                {SECTIONS.map(({ id, label, icon }) => {
                  const active = activeSection === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveSection(id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${
                        active ? "bg-landing-bg-alt text-landing-text" : "text-landing-muted hover:bg-landing-bg-alt/60"
                      }`}
                    >
                      <span className={active ? "text-landing-accent" : "text-landing-muted"}>{icon}</span>
                      {label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 flex flex-col gap-6">
            {activeSection === "profile" && (
              <>
                <SectionCard
                  label="Account details"
                  icon={
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  }
                >
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="fullName" className="block text-xs font-semibold mb-2 text-landing-text tracking-wide">
                        FULL NAME
                      </label>
                      <input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label htmlFor="editPhone" className="text-xs font-semibold text-landing-text tracking-wide">
                          PHONE NUMBER
                        </label>
                        {initialPhone && !confirmingPhoneDelete && (
                          <button
                            type="button"
                            onClick={() => setConfirmingPhoneDelete(true)}
                            className="text-xs font-medium text-landing-accent hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        id="editPhone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 03xx xxxxxxx"
                        className={inputClass}
                      />
                      {confirmingPhoneDelete && (
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-landing-muted">Remove your phone number?</span>
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
                            className="text-xs font-medium text-landing-muted hover:text-landing-text"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>

                <SaveBar onSave={handleSave} onCancel={handleCancel} saving={saving} />
              </>
            )}

            {activeSection === "resume" && (
              <>
                <SectionCard
                  label="Resume"
                  icon={
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  {resumeUrl && !newResumeFile && (
                    <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-5 bg-landing-bg-alt border border-landing-border">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-landing-accent-bg text-landing-accent">
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-landing-text">Current resume</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-landing-accent">
                          View ↗
                        </a>
                        {!confirmingResumeDelete ? (
                          <button
                            type="button"
                            onClick={() => setConfirmingResumeDelete(true)}
                            className="text-xs font-medium text-landing-muted hover:text-landing-text"
                          >
                            Remove
                          </button>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleDeleteResume}
                              disabled={deletingResume}
                              className="text-xs font-semibold text-danger hover:underline disabled:opacity-50"
                            >
                              {deletingResume ? "Removing..." : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingResumeDelete(false)}
                              disabled={deletingResume}
                              className="text-xs font-medium text-landing-muted hover:text-landing-text"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <label
                    htmlFor="resume"
                    className="rounded-xl flex flex-col items-center justify-center py-12 px-6 cursor-pointer transition-colors text-center border-2 border-dashed border-landing-border bg-landing-bg-alt/50 hover:border-landing-accent hover:bg-landing-accent-bg"
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-landing-bg-alt text-landing-muted">
                      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    {newResumeFile ? (
                      <p className="text-sm font-semibold text-landing-text">{newResumeFile.name}</p>
                    ) : (
                      <>
                        <p className="text-sm font-semibold mb-1 text-landing-text">
                          {resumeUrl ? "Replace resume" : "Upload resume"}
                        </p>
                        <p className="text-xs text-landing-muted">
                          Click to <span className="text-landing-accent font-semibold">browse</span> — PDF, up to 5MB
                        </p>
                      </>
                    )}
                    <input id="resume" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                  </label>
                </SectionCard>

                <SaveBar onSave={handleSave} onCancel={handleCancel} saving={saving} />
              </>
            )}

            {activeSection === "skills" && (
              <>
                <SectionCard
                  label="Skills"
                  icon={
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  <div className="flex items-center justify-between mb-2 -mt-2">
                    <span />
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-landing-accent-bg text-landing-accent">
                      {selectedSkillIds.length} selected
                    </span>
                  </div>
                  <p className="text-sm mb-6 text-landing-muted">
                    Select the areas you want to be assessed and matched on.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {skillCatalog.map((skill) => {
                      const active = selectedSkillIds.includes(skill.id);
                      return (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => toggleSkill(skill.id)}
                          className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                            active
                              ? "bg-landing-text text-white border-landing-text"
                              : "bg-landing-bg-alt text-landing-muted border-landing-border hover:border-landing-text hover:text-landing-text"
                          }`}
                        >
                          {active && <span className="mr-1.5 text-landing-accent">✓</span>}
                          {skill.name}
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>

                <SaveBar onSave={handleSave} onCancel={handleCancel} saving={saving} />
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
