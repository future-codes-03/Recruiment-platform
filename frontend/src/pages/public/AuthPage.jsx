import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../context/AuthContext";
import { signupCandidate, signupCompany } from "../../api/auth";
import { getErrorMessage } from "../../api/errors";
import Button from "../../components/shared/Button";

// Basic RFC-5322-ish check — good enough to catch typos, not meant to be
// exhaustive (the backend is the real source of truth on validity).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Pakistani mobile: 03XXXXXXXXX — 11 digits, starts with 03. Strips spaces
// and dashes before testing so "0300-1234567" and "03001234567" both pass.
const PHONE_PATTERN = /^03\d{9}$/;
const NOT_BLANK = (v) => v.trim().length > 0 || "This can't be just whitespace";
const VALID_ROLES = ["candidate", "employer"];

export default function AuthPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const [error, setError] = useState("");

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

  // Candidates land on /onboarding automatically until they've uploaded a
  // resume (resume_url is set server-side once they do — see
  // accounts/models.py). After that, straight to /dashboard. Employers
  // always go to /employer/dashboard; they don't have an onboarding step.
  function postLoginPath(user) {
    if (user.role !== "candidate") return "/employer/dashboard";
    return user.resume_url ? "/dashboard" : "/onboarding";
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

  const inputClass =
    "w-full border border-line rounded-xl px-3.5 py-2.5 text-sm mt-1.5 mb-3 bg-surface focus:outline-none focus:ring-2 focus:ring-brass/40 focus:border-brass transition-colors";
  const labelClass = "text-xs uppercase tracking-wide text-slate font-semibold";

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-paper">
      {/* Branded panel — hidden on mobile, shown alongside the form on
          larger screens. Purely decorative, no interactive elements. */}
      <div className="hidden md:flex flex-col justify-between bg-ink text-white p-10 lg:p-14">
        <Link to="/" className="font-display font-bold text-lg flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-brass inline-block" />
          skillbridge
        </Link>
        <div>
          <div className="text-xs font-semibold text-brass uppercase tracking-widelabel mb-4">
            Guaranteed interview slots
          </div>
          <h2 className="font-display text-3xl font-bold leading-tight max-w-sm">
            Skill, measured. Interviews, guaranteed.
          </h2>
          <p className="text-white/60 text-sm mt-4 max-w-sm">
            Clear the published skill minimums first, and the interview slot
            locks in for you — no resume screening, no waiting on a recruiter.
          </p>
        </div>
        <div className="text-xs text-white/40">Built for the Pakistani software market.</div>
      </div>

      <div className="flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="md:hidden font-display font-bold text-lg flex items-center gap-2 mb-8 text-ink">
            <span className="w-6 h-6 rounded-md bg-brass inline-block" />
            skillbridge
          </Link>

          <h1 className="font-display text-xl font-bold text-ink mb-1">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-slate mb-6">
            {mode === "login" ? "Log in to continue." : "Get started with skillbridge."}
          </p>

          <div className="inline-flex p-1 bg-card rounded-full mb-6">
            <button
              type="button"
              onClick={() => setRole("candidate")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                role === "candidate" ? "bg-ink text-white" : "text-slate"
              }`}
            >
              I'm a candidate
            </button>
            <button
              type="button"
              onClick={() => setRole("employer")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                role === "employer" ? "bg-ink text-white" : "text-slate"
              }`}
            >
              I'm hiring
            </button>
          </div>

          {error && (
            <div className="bg-danger-bg text-danger text-xs rounded-xl px-3.5 py-2.5 mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
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
              {mode === "signup" && role === "employer" ? "Work email" : "Email"}
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

            <label htmlFor="password" className={labelClass}>Password</label>
            <input
              id="password"
              type="password"
              placeholder="********"
              className={`${inputClass} mb-1`}
              {...register("password", { required: "Password is required", minLength: { value: 8, message: "Password must be at least 8 characters" } })}
            />
            {errors.password && (
              <p className="text-danger text-xs mb-2">{errors.password.message}</p>
            )}

            {mode === "signup" && (
              <>
                <label htmlFor="confirm_password" className={labelClass}>Confirm password</label>
                <input
                  id="confirm_password"
                  type="password"
                  placeholder="********"
                  className={`${inputClass} mb-1`}
                  {...register("confirm_password", {
                    required: "Please confirm your password",
                    validate: (v) => v === watch("password") || "Passwords don't match",
                  })}
                />
                {errors.confirm_password && (
                  <p className="text-danger text-xs mb-2">{errors.confirm_password.message}</p>
                )}
              </>
            )}

            {mode === "login" && (
              <div className="text-right text-xs text-brass-dark font-medium mb-4">
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full mt-3 rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? "Please wait..." : "Continue"}
            </Button>
          </form>

          {role === "candidate" && (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="h-px bg-line flex-1" />
                <div className="text-xs text-slate">or</div>
                <div className="h-px bg-line flex-1" />
              </div>
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google sign-in failed. Please try again.")}
                />
              </div>
            </>
          )}

          <div className="text-center text-xs text-slate mt-5">
            {mode === "login" ? (
              <>Don't have an account?{" "}
                <button className="text-brass-dark font-semibold" onClick={() => setMode("signup")}>Sign up</button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button className="text-brass-dark font-semibold" onClick={() => setMode("login")}>Log in</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
