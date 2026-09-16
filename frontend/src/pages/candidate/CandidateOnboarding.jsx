import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { updateMyProfile } from "../../api/profile";
import { getErrorMessage } from "../../api/errors";
import Button from "../../components/shared/Button";
import Card from "../../components/shared/Card";
import ProgressBar from "../../components/shared/ProgressBar";

// Candidate profile fields the backend User model already has
// (resume_url, cv_uploaded_at — see accounts/models.py). Skill tags are
// free-text strings on submit; the backend canonicalizes them against its
// own Skill catalog (case-insensitive match-or-create).
const SKILL_OPTIONS = [
  "Backend", "Frontend", "Full-stack", "DevOps", "Mobile",
  "Data / ML", "QA / Testing", "UI/UX Design",
];

export default function CandidateOnboarding() {
  const navigate = useNavigate();
  const { user, setSession } = useAuth();
  const [step, setStep] = useState(1);
  const [resumeFile, setResumeFile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totalSteps = 2;

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
    setResumeFile(file);
  }

  // Sends only whatever the candidate actually provided this run — a PATCH
  // with just cv, just skills, both, or (if both were skipped) no call at
  // all. The backend's write serializer accepts partial data via PATCH.
  async function submitProfile() {
    if (!resumeFile && skills.length === 0) {
      navigate("/dashboard");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      if (resumeFile) formData.append("cv", resumeFile);
      skills.forEach((skill) => formData.append("skills", skill));

      const profile = await updateMyProfile(formData);

      // Keep the cached user in sync so Dashboard's "profile incomplete"
      // banner and any resume_url check reflect this save immediately,
      // without waiting for the next login.
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
    if (step === 1 && !resumeFile) {
      setError("Upload a resume to continue, or skip for now.");
      return;
    }
    setError("");
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      submitProfile();
    }
  }

  function handleSkip() {
    setError("");
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      submitProfile();
    }
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
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="font-display text-xl font-bold text-ink mb-1">What are you looking for?</h1>
              <p className="text-sm text-slate mb-6">
                Pick a few — this just shapes which guaranteed-slot roles we surface first.
              </p>

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