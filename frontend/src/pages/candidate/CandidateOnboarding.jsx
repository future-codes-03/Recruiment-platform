import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { updateMyProfile } from "../../api/profile";
import { getSkillCatalog } from "../../api/skills";
import { getErrorMessage } from "../../api/errors";
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
  // Only show the skill picker if skills are actually missing — a
  // candidate re-entering onboarding to fix something else (e.g. they just
  // deleted their resume) shouldn't be shown an empty-looking skill picker
  // that makes it look like their existing skills were wiped.
  const skillsMissing = missingFields.includes("skills");
  const totalSteps = skillsMissing ? 2 : 1;

  const [phone, setPhone] = useState(user?.phone || "");
  const [fullName, setFullName] = useState(user?.full_name || "");

  const [skillCatalog, setSkillCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState([]);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!skillsMissing) return;
    getSkillCatalog()
      .then(setSkillCatalog)
      .catch(() => setCatalogError("Couldn't load the skills list. Try refreshing."));
  }, [skillsMissing]);

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

  // Sends only whatever the candidate actually provided this run — skills
  // is included only when this run's step 2 actually existed (skillsMissing),
  // so an onboarding pass that's only here to fix the resume never touches
  // the skills the candidate already has saved.
  async function submitProfile() {
    const hasPhoneUpdate = phoneRequired && phone.trim();
    const hasNameUpdate = nameRequired && fullName.trim();
    const hasSkillsUpdate = skillsMissing && selectedSkillIds.length > 0;
    if (!resumeFile && !hasSkillsUpdate && !hasPhoneUpdate && !hasNameUpdate) {
      navigate("/dashboard");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      if (resumeFile) formData.append("cv", resumeFile);
      if (hasSkillsUpdate) {
        selectedSkillIds.forEach((id) => formData.append("skills", id));
      }
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
      if (step < totalSteps) {
        setStep(2);
      } else {
        submitProfile();
      }
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
      if (step < totalSteps) {
        setStep(2);
      } else {
        submitProfile();
      }
      return;
    }
    setError("");
    submitProfile();
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-landing-bg-alt to-landing-card flex items-center justify-center px-4 sm:px-6 py-10 font-body">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-0 text-lg font-bold tracking-tight mb-8">
          <span className="text-landing-text">skill</span>
          <span className="text-landing-accent">bridge</span>
        </div>

        <ProgressBar value={step} max={totalSteps} label="Setting up your profile" showValue className="mb-6" />

        <Card className="bg-landing-bg border border-landing-border">
          {step === 1 && (
            <>
              <h1 className="font-landing-display text-xl font-bold text-landing-text mb-1">
                Welcome{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}.
              </h1>
              <p className="text-sm text-landing-muted mb-6">
                Upload your resume so employers can see who's behind each qualifying attempt.
              </p>

              <label
                htmlFor="resume"
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-landing-border rounded-xl py-10 px-6 cursor-pointer hover:border-landing-accent hover:bg-landing-accent-bg transition-colors text-center"
              >
                <span className="w-10 h-10 rounded-full bg-landing-bg-alt flex items-center justify-center text-landing-accent font-bold text-lg">
                  ↑
                </span>
                {resumeFile ? (
                  <span className="text-sm font-semibold text-landing-text">{resumeFile.name}</span>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-landing-text">Click to upload your resume</span>
                    <span className="text-xs text-landing-muted">PDF, up to 5MB</span>
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
                  <label htmlFor="fullName" className="text-xs font-semibold text-landing-muted uppercase tracking-wide block mb-1.5">
                    Full name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ayesha Khan"
                    className="w-full rounded-lg border border-landing-border px-3.5 py-2.5 text-sm text-landing-text focus:outline-none focus:border-landing-text"
                  />
                  <p className="text-xs text-landing-muted mt-1.5">
                    So employers know who they're talking to.
                  </p>
                </div>
              )}

              <div className="mt-6">
                <label htmlFor="phone" className="text-xs font-semibold text-landing-muted uppercase tracking-wide block mb-1.5">
                  Phone number{phoneRequired ? "" : " (on file)"}
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 03xx xxxxxxx"
                  className="w-full rounded-lg border border-landing-border px-3.5 py-2.5 text-sm text-landing-text focus:outline-none focus:border-landing-text"
                />
                {phoneRequired && (
                  <p className="text-xs text-landing-muted mt-1.5">
                    Needed so employers can reach you about an interview.
                  </p>
                )}
              </div>
            </>
          )}

          {step === 2 && skillsMissing && (
            <>
              <h1 className="font-landing-display text-xl font-bold text-landing-text mb-1">What are you looking for?</h1>
              <p className="text-sm text-landing-muted mb-6">
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
                          ? "bg-landing-text text-white border-landing-text"
                          : "bg-landing-bg text-landing-text border-landing-border hover:border-landing-accent"
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
              className="text-sm font-medium text-landing-muted hover:text-landing-text disabled:opacity-50"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={submitting}
              className="px-5 py-2.5 rounded-full text-sm font-semibold bg-landing-text text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Saving..." : step < totalSteps ? "Continue" : "Go to dashboard"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}