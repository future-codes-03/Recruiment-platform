import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { resetPassword } from "../../api/auth";
import { getErrorMessage } from "../../api/errors";

// Purely visual strength meter — informational only, does not gate
// submission. The real requirement (>= 8 chars) is enforced in handleSubmit,
// same as before.
function StrengthBar({ password }) {
  if (!password) return null;

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["#dde3ec", "#c94b2e", "#e8a020", "#6b9e6b", "#2a7a4b"];

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors duration-300"
            style={{ background: i <= score ? colors[score] : "#dde3ec" }}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color: colors[score] }}>{labels[score]}</p>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.7 18.7 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const REQUIREMENTS = [
  { test: (p) => p.length >= 8, text: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p), text: "One uppercase letter" },
  { test: (p) => /[0-9]/.test(p), text: "One number" },
  { test: (p) => /[^A-Za-z0-9]/.test(p), text: "One special character" },
];

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState("form"); // form | saving | success | error
  const [error, setError] = useState("");

  const mismatch = confirm.length > 0 && password !== confirm;

  useEffect(() => {
    if (status === "success") {
      const t = setTimeout(() => navigate("/login"), 2000);
      return () => clearTimeout(t);
    }
  }, [status, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setStatus("saving");
    try {
      await resetPassword({ reset_token: token, new_password: password });
      setStatus("success");
    } catch (err) {
      setError(getErrorMessage(err, "This link is invalid or has expired."));
      setStatus("error");
    }
  }

  const inputClass =
    "w-full border rounded-xl px-3.5 py-3 pr-11 text-sm bg-landing-bg text-landing-text focus:outline-none transition-colors";

  return (
    <div className="min-h-screen bg-linear-to-br from-landing-bg-alt to-landing-card font-body">
      <header className="bg-landing-bg border-b border-landing-border-sub">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold tracking-tight select-none">
            <span className="text-landing-text">skill</span>
            <span className="text-landing-accent">bridge</span>
          </Link>
          <Link to="/login" className="flex items-center gap-1.5 text-sm text-landing-muted hover:text-landing-text transition-colors">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to login
          </Link>
        </div>
      </header>

      <main className="flex items-center justify-center px-4 py-16 lg:py-24">
        <div className="w-full max-w-110">
          <p className="flex items-center justify-center gap-2 text-sm font-medium mb-8 text-landing-accent">
            <span className="w-2 h-2 rounded-full inline-block bg-landing-accent" />
            Account recovery
          </p>

          <div className="rounded-3xl p-8 sm:p-10 bg-landing-bg border border-landing-border shadow-[0_4px_24px_rgba(26,26,46,0.06)]">
            {!token && (
              <>
                <h1 className="font-landing-display text-2xl font-bold mb-2 text-landing-text">Missing reset link</h1>
                <p className="text-sm mb-6 text-landing-muted leading-relaxed">
                  This page only works from the link in your password reset email.
                </p>
                <Link to="/forgot-password" className="text-sm font-semibold text-landing-accent hover:underline">
                  Request a new link →
                </Link>
              </>
            )}

            {token && status === "success" && (
              <>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 bg-landing-accent-bg text-landing-accent">
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </div>
                <h1 className="font-landing-display text-3xl font-bold mb-2 text-landing-text">Password updated.</h1>
                <p className="text-sm mb-8 text-landing-muted leading-relaxed">
                  Your password has been reset successfully. Taking you to login...
                </p>
                <Link
                  to="/login"
                  className="block text-center w-full py-3.5 rounded-xl text-sm font-semibold bg-landing-text text-white hover:opacity-90 transition-opacity"
                >
                  Continue to login →
                </Link>
              </>
            )}

            {token && status !== "success" && (
              <>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 bg-landing-accent-bg text-landing-accent">
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <h1 className="font-landing-display text-3xl font-bold mb-2 text-landing-text">Set a new password.</h1>
                <p className="text-sm mb-8 text-landing-muted leading-relaxed">
                  Choose something strong. You won't be asked for it again until your session expires.
                </p>

                {error && (
                  <div className="bg-danger-bg text-danger text-xs rounded-xl px-3.5 py-2.5 mb-4">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div>
                    <label htmlFor="password" className="block text-xs font-semibold mb-2 text-landing-text tracking-wide">
                      NEW PASSWORD
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${inputClass} border-landing-border focus:border-landing-text`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-landing-muted hover:text-landing-text"
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    <StrengthBar password={password} />
                  </div>

                  <div>
                    <label htmlFor="confirm" className="block text-xs font-semibold mb-2 text-landing-text tracking-wide">
                      CONFIRM PASSWORD
                    </label>
                    <div className="relative">
                      <input
                        id="confirm"
                        type={showConfirm ? "text" : "password"}
                        required
                        placeholder="Repeat your password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className={`${inputClass} ${mismatch ? "border-danger" : "border-landing-border focus:border-landing-text"}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        tabIndex={-1}
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-landing-muted hover:text-landing-text"
                      >
                        {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {mismatch && <p className="text-xs mt-1.5 text-danger">Passwords do not match.</p>}
                  </div>

                  <div className="rounded-xl p-4 text-xs flex flex-col gap-2 bg-landing-bg-alt border border-landing-border text-landing-muted">
                    {REQUIREMENTS.map(({ test, text }) => {
                      const met = test(password);
                      return (
                        <div key={text} className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                              met ? "bg-landing-text" : "bg-landing-border"
                            }`}
                          >
                            {met && (
                              <svg width="8" height="8" fill="none" viewBox="0 0 10 10">
                                <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span className={met ? "text-landing-text" : "text-landing-muted"}>{text}</span>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="submit"
                    disabled={status === "saving"}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold bg-landing-text text-white hover:opacity-90 transition-opacity disabled:opacity-50 mt-1"
                  >
                    {status === "saving" ? "Saving..." : "Set new password →"}
                  </button>
                </form>

                {status === "error" && (
                  <Link to="/forgot-password" className="block mt-4 text-sm text-landing-accent font-semibold hover:underline">
                    Request a new link →
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
