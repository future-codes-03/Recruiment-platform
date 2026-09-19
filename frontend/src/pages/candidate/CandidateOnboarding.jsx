import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { updateMyProfile } from "../../api/profile";
import { getSkillCatalog } from "../../api/skills";
import { getErrorMessage } from "../../api/errors";
import Button from "../../components/shared/Button";
import Card from "../../components/shared/Card";
import ProgressBar from "../../components/shared/ProgressBar";

export default function CandidateOnboarding() {
  const navigate = useNavigate();
  const { user, setSession } = useAuth();
  const [step, setStep] = useState(1);

  const [resumeFile, setResumeFile] = useState(null);

  // Driven by the backend's missing_fields, not re-derived locally — it's
  // auth_provider-aware server-side (a Google signup may lack phone and/or
  // full_name; an email/password signup collected both at signup and will
  // never have either listed here).
  const missingFields = user?.missing_fields || [];
  const phoneRequired = missingFields.includes("phone");
  const nameRequired = missingFields.includes("full_name");

  const [phone, setPhone] = useState(user?.phone || "");
  const [fullName, setFullName] = useState(user?.full_name || "");

  const [skillCatalog, setSkillCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState([]);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totalSteps = 2;

  useEffect(() => {
    getSkillCatalog()
      .then(setSkillCatalog)
      .catch(() => setCatalogError("Couldn't load the skills list. Try refreshing."));
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
    setResumeFile(file);
  }

  // The one gate both Continue and Skip run through on step 1 — resume
  // stays optional either way, phone and full name (when the backend says
  // they're missing) are not.
  function checkRequiredBeforeLeavingStep1() {
    if (phoneRequired && !phone.trim()) {
      setError("Add a phone number so employers can reach you.");
      return false;
    }
    if (nameRequired && !fullName.trim()) {
      setError("Add your full name to continue.");
      return false;
    }
    return true;
  }

  // Sends only whatever the candidate actually provided this run. The
  // backend's write serializer accepts partial data via PATCH, but
  // onboarding always has at least a resume, skills, or a first-time
  // phone/name once it gets here, so PUT-shaped (full submission) is fine
  // for the common case; falling through to "nothing to send" only
  // happens if nothing required was outstanding and both steps were
  // skipped outright.
  async function submitProfile() {
    const hasPhoneUpdate = phoneRequired && phone.trim();
    const hasNameUpdate = nameRequired && fullName.trim();
    if (!resumeFile && selectedSkillIds.length === 0 && !hasPhoneUpdate && !hasNameUpdate) {
      navigate("/dashboard");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      if (resumeFile) formData.append("cv", resumeFile);
      selectedSkillIds.forEach((id) => formData.append("skills", id));
      if (hasPhoneUpdate) formData.append("phone", phone.trim());
      if (hasNameUpdate) formData.append("full_name", fullName.trim());

      const profile = await updateMyProfile(formData);

      const token = localStorage.getItem("skillbridge_access_token");
      setSession({ ...user, ...profile }, token);

      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your profile. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    if (step === 1) {
      if (!resumeFile) {
        setError("Upload a resume to continue, or skip for now.");
        return;
      }
      if (!checkRequiredBeforeLeavingStep1()) return;
      setError("");
      setStep(2);
      return;
    }
    setError("");
    submitProfile();
  }

  function handleSkip() {
    if (step === 1) {
      // Resume is skippable, phone/full name (when required) are not —
      // same gate as Continue, minus the resume requirement.
      if (!checkRequiredBeforeLeavingStep1()) return;
      setError("");
      setStep(2);
      return;
    }
    setError("");
    submitProfile();
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 sm:px-6 py-10">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 font-display font-bold text-lg text-ink mb-8 justify-center">
          <span className="w-6 h-6 rounded-md bg-brass inline-block" />
          skillbridge
        </div>

        <ProgressBar value={step} max={totalSteps} label="Setting up your profile" showValue className="mb-6" />

        <Card className="bg-surface">
          {step === 1 && (
            <>
              <h1 className="font-display text-xl font-bold text-ink mb-1">
                Welcome{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}.
              </h1>
              <p className="text-sm text-slate mb-6">
                Upload your resume so employers can see who's behind each qualifying attempt.
              </p>

              <label
                htmlFor="resume"
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-10 px-6 cursor-pointer hover:border-brass hover:bg-brass-light/40 transition-colors text-center"
              >
                <span className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-brass-dark font-bold text-lg">
                  ↑
                </span>
                {resumeFile ? (
                  <span className="text-sm font-semibold text-ink">{resumeFile.name}</span>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-ink">Click to upload your resume</span>
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

              {nameRequired && (
                <div className="mt-6">
                  <label htmlFor="fullName" className="text-xs font-semibold text-slate uppercase tracking-wide block mb-1.5">
                    Full name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ayesha Khan"
                    className="w-full rounded-lg border border-line px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-brass"
                  />
                  <p className="text-xs text-slate mt-1.5">
                    So employers know who they're talking to.
                  </p>
                </div>
              )}

              <div className="mt-6">
                <label htmlFor="phone" className="text-xs font-semibold text-slate uppercase tracking-wide block mb-1.5">
                  Phone number{phoneRequired ? "" : " (on file)"}
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 03xx xxxxxxx"
                  className="w-full rounded-lg border border-line px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-brass"
                />
                {phoneRequired && (
                  <p className="text-xs text-slate mt-1.5">
                    Needed so employers can reach you about an interview.
                  </p>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="font-display text-xl font-bold text-ink mb-1">What are you looking for?</h1>
              <p className="text-sm text-slate mb-6">
                Pick a few — this just shapes which guaranteed-slot roles we surface first.
              </p>

              {catalogError && <p className="text-danger text-xs mb-4">{catalogError}</p>}

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
            </>
          )}

          {error && <p className="text-danger text-xs mt-4">{error}</p>}

          <div className="flex items-center justify-between mt-8">
            <button
              type="button"
              onClick={handleSkip}
              disabled={submitting}
              className="text-sm font-medium text-slate hover:text-ink disabled:opacity-50"
            >
              Skip for now
            </button>
            <Button variant="primary" className="rounded-full" onClick={handleContinue} disabled={submitting}>
              {submitting ? "Saving..." : step < totalSteps ? "Continue" : "Go to dashboard"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}