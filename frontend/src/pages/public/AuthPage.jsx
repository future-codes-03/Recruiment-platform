import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../context/AuthContext";
import { signupCandidate, signupCompany, resendVerification } from "../../api/auth";
import { getErrorMessage } from "../../api/errors";

// Basic RFC-5322-ish check — good enough to catch typos, not meant to be
// exhaustive (the backend is the real source of truth on validity).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Pakistani mobile: 03XXXXXXXXX — 11 digits, starts with 03. Strips spaces
// and dashes before testing so "0300-1234567" and "03001234567" both pass.
const PHONE_PATTERN = /^03\d{9}$/;
const NOT_BLANK = (v) => v.trim().length > 0 || "This can't be just whitespace";
const VALID_ROLES = ["candidate", "employer"];

// Small inline SVGs — no new icon dependency for a two-icon toggle.
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

// Wraps a password <input> with a show/hide toggle button. Kept as a small
// local component rather than duplicating the button markup twice (login
// password, and — on signup — password + confirm password).
function PasswordField({ id, placeholder, registerProps, className, error }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          className={`${className} pr-10`}
          {...registerProps}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-landing-muted hover:text-landing-text"
          style={{ marginTop: "-6px" }}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && <p className="text-danger text-xs mb-2">{error}</p>}
    </>
  );
}

export default function AuthPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const [error, setError] = useState("");

  // Login can fail for two indistinguishable reasons server-side — wrong
  // password, or a real password match on an account that's never been
  // verified (LoginSerializer folds both into the same generic message on
  // purpose, so a caller can't tell which happened). Surfacing a resend
  // option after ANY login failure — worded to not assert unverified is
  // the cause — is what makes an unverified account recoverable at all
  // without leaking whether that's what actually happened.
  const [resendState, setResendState] = useState("idle"); // idle | sending | sent
  const [resendError, setResendError] = useState("");

  // mode and role both live in the URL, not local state — that's what makes
  // the toggle buttons and the URL agree, and what makes the buttons survive
  // a page refresh or a shared link.
  const mode = location.pathname === "/signup" ? "signup" : "login";
  const rawAs = searchParams.get("as");
  const role = rawAs === "employer" ? "employer" : "candidate";

  // A junk value like ?as=candidatee shouldn't 404 (the page itself is
  // valid) but it also shouldn't sit in the address bar disagreeing with
  // what's on screen — silently defaulting to "candidate" while the URL
  // still says "candidatee" is the same address-bar/screen mismatch as the
  // routing bug, just one level down. Rewrite it to the value actually in
  // use. No-op when ?as= is absent entirely — that's a normal, valid URL.
  useEffect(() => {
    if (rawAs !== null && !VALID_ROLES.includes(rawAs)) {
      setSearchParams({ as: "candidate" }, { replace: true });
    }
  }, [rawAs, setSearchParams]);

  function setRole(nextRole) {
    setSearchParams({ as: nextRole }, { replace: true });
  }

  function setMode(nextMode) {
    navigate(`/${nextMode}?as=${role}`);
  }

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();

  // Candidates land on /onboarding automatically until they've cleared the
  // profile-completion gate; email/password candidates never have phone/
  // full_name on missing_fields (both were collected at signup), so this
  // reduces to the pre-existing resume_url check for them. See
  // required_profile_fields() in accounts/serializers.py for the source of
  // truth this mirrors. Employers always go to /employer/dashboard; they
  // don't have an onboarding step.
  function postLoginPath(user) {
    if (user.role !== "candidate") return "/employer/dashboard";
    const missing = user.missing_fields || [];
    const hasBlockingGap = missing.includes("phone") || missing.includes("full_name");
    if (hasBlockingGap || !user.resume_url) return "/onboarding";
    return "/dashboard";
  }

  // Candidate-only, see .claude/specs/login-with-google.md. Not part of the
  // react-hook-form-driven flow above — GoogleLogin manages its own pending
  // UI, so this only needs the same error state the form already uses.
  async function handleGoogleSuccess(credentialResponse) {
    setError("");
    try {
      const user = await loginWithGoogle(credentialResponse.credential);
      navigate(postLoginPath(user));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function onSubmit(values) {
    setError("");
    setResendState("idle");
    setResendError("");
    try {
      if (mode === "login") {
        const user = await login(values.email, values.password);
        navigate(postLoginPath(user));
        return;
      }

      if (role === "candidate") {
        await signupCandidate({
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          phone: values.phone,
        });
        navigate(`/verify-email?email=${encodeURIComponent(values.email)}`);
      } else {
        // This covers only the company + admin-account fields signupCompany
        // needs. Extra company detail (industry, size, etc.) belongs in a
        // later employer onboarding step, same way candidate profile detail
        // beyond name/phone belongs in candidate onboarding, not here.
        await signupCompany({
          company_name: values.company_name,
          admin_full_name: values.full_name,
          admin_email: values.email,
          admin_password: values.password,
        });
        navigate(`/verify-email?email=${encodeURIComponent(values.email)}`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  // Backend always returns 200 with a generic message regardless of
  // whether the account exists, is already verified, or genuinely got a
  // new link — never distinguishing is the point, so there's no error
  // branch to design for here beyond a network/validation failure.
  async function handleResend() {
    const email = watch("email");
    if (!email) return;
    setResendState("sending");
    setResendError("");
    try {
      await resendVerification({ email });
      setResendState("sent");
    } catch (err) {
      setResendState("idle");
      setResendError(getErrorMessage(err, "Couldn't send that right now. Try again."));
    }
  }

  const inputClass =
    "w-full border border-landing-border rounded-xl px-3.5 py-2.5 text-sm mt-1.5 mb-3 bg-landing-bg text-landing-text focus:outline-none focus:border-landing-text transition-colors";
  const labelClass = "text-xs uppercase tracking-wide text-landing-text font-semibold";

  return (
    <div className="min-h-screen bg-linear-to-br from-landing-bg-alt to-landing-card font-body">
      {/* Nav */}
      <header className="bg-landing-bg border-b border-landing-border-sub">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold tracking-tight select-none">
            <span className="text-landing-text">skill</span>
            <span className="text-landing-accent">bridge</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-landing-muted hover:text-landing-text transition-colors">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex items-center justify-center px-4 py-16 lg:py-24">
        <div className="w-full max-w-110">
          <p className="flex items-center justify-center gap-2 text-sm font-medium mb-8 text-landing-accent">
            <span className="w-2 h-2 rounded-full inline-block bg-landing-accent" />
            Fair chances, clearly earned
          </p>

          <div className="rounded-3xl p-8 sm:p-10 bg-landing-bg border border-landing-border shadow-[0_4px_24px_rgba(26,26,46,0.06)]">
            <h1 className="font-landing-display text-3xl font-bold mb-2 text-landing-text">
              {mode === "login" ? "Welcome back." : "Create your account."}
            </h1>
            <p className="text-sm mb-8 text-landing-muted">
              {mode === "login"
                ? "Log in to continue your path to a guaranteed interview."
                : "Get started on your path to a guaranteed interview."}
            </p>

            <div className="inline-flex p-1 bg-landing-bg-alt rounded-full mb-6">
              <button
                type="button"
                onClick={() => setRole("candidate")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  role === "candidate" ? "bg-landing-text text-white" : "text-landing-muted"
                }`}
              >
                I'm a candidate
              </button>
              <button
                type="button"
                onClick={() => setRole("employer")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  role === "employer" ? "bg-landing-text text-white" : "text-landing-muted"
                }`}
              >
                I'm hiring
              </button>
            </div>

            {error && (
              <div className="bg-danger-bg text-danger text-xs rounded-xl px-3.5 py-2.5 mb-4">
                <p>{error}</p>
                {mode === "login" && resendState !== "sent" && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendState === "sending"}
                    className="text-danger font-semibold underline mt-1.5 disabled:opacity-60"
                  >
                    {resendState === "sending"
                      ? "Sending..."
                      : "If your account isn't verified yet, resend the verification email"}
                  </button>
                )}
                {resendError && <p className="mt-1.5">{resendError}</p>}
              </div>
            )}

            {resendState === "sent" && (
              <div className="bg-success-bg text-success text-xs rounded-xl px-3.5 py-2.5 mb-4">
                If that email needs verification, a new link has been sent.
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
              {mode === "signup" && role === "employer" && (
                <>
                  <label htmlFor="company_name" className={labelClass}>Company name</label>
                  <input
                    id="company_name"
                    placeholder="Acme Software"
                    className={inputClass}
                    {...register("company_name", { required: "Company name is required", validate: NOT_BLANK })}
                  />
                  {errors.company_name && <p className="text-danger text-xs mb-2">{errors.company_name.message}</p>}
                </>
              )}

              {mode === "signup" && (
                <>
                  <label htmlFor="full_name" className={labelClass}>
                    {role === "employer" ? "Your full name" : "Full name"}
                  </label>
                  <input
                    id="full_name"
                    placeholder="Jane Doe"
                    className={inputClass}
                    {...register("full_name", { required: "Full name is required", validate: NOT_BLANK })}
                  />
                  {errors.full_name && <p className="text-danger text-xs mb-2">{errors.full_name.message}</p>}
                </>
              )}

              <label htmlFor="email" className={labelClass}>
                {mode === "signup" && role === "employer" ? "Work email" : "Email address"}
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className={inputClass}
                {...register("email", {
                  required: "Email is required",
                  pattern: { value: EMAIL_PATTERN, message: "Enter a valid email address" },
                })}
              />
              {errors.email && <p className="text-danger text-xs mb-2">{errors.email.message}</p>}

              {mode === "signup" && role === "candidate" && (
                <>
                  <label htmlFor="phone" className={labelClass}>Phone</label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="03XX-XXXXXXX"
                    className={inputClass}
                    {...register("phone", {
                      required: "Phone is required",
                      pattern: {
                        value: PHONE_PATTERN,
                        message: "Enter a valid Pakistani mobile number, e.g. 03001234567",
                      },
                      setValueAs: (v) => v.replace(/[\s-]/g, ""),
                    })}
                  />
                  {errors.phone && <p className="text-danger text-xs mb-2">{errors.phone.message}</p>}
                </>
              )}

              <div className="flex items-center justify-between">
                <label htmlFor="password" className={labelClass}>Password</label>
                {mode === "login" && (
                  <Link to="/forgot-password" className="text-xs font-medium text-landing-accent">
                    Forgot password?
                  </Link>
                )}
              </div>
              <PasswordField
                id="password"
                placeholder="********"
                className={`${inputClass} mb-1`}
                registerProps={register("password", {
                  required: "Password is required",
                  minLength: { value: 8, message: "Password must be at least 8 characters" },
                })}
                error={errors.password?.message}
              />

              {mode === "signup" && (
                <>
                  <label htmlFor="confirm_password" className={labelClass}>Confirm password</label>
                  <PasswordField
                    id="confirm_password"
                    placeholder="********"
                    className={`${inputClass} mb-1`}
                    registerProps={register("confirm_password", {
                      required: "Please confirm your password",
                      validate: (v) => v === watch("password") || "Passwords don't match",
                    })}
                    error={errors.confirm_password?.message}
                  />
                </>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 mt-2 bg-landing-text text-white disabled:opacity-60"
              >
                {isSubmitting ? "Please wait..." : mode === "login" ? "Log in →" : "Create account →"}
              </button>
            </form>

            {role === "candidate" && (
              <>
                <div className="flex items-center gap-3 my-7">
                  <div className="flex-1 h-px bg-landing-border" />
                  <span className="text-xs text-landing-muted">or continue with</span>
                  <div className="flex-1 h-px bg-landing-border" />
                </div>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError("Google sign-in failed. Please try again.")}
                  />
                </div>
              </>
            )}
          </div>

          <p className="text-center text-sm mt-7 text-landing-muted">
            {mode === "login" ? (
              <>Don't have an account?{" "}
                <button className="font-semibold text-landing-text" onClick={() => setMode("signup")}>
                  Create an account →
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button className="font-semibold text-landing-text" onClick={() => setMode("login")}>
                  Log in →
                </button>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}