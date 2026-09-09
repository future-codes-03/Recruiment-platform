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

  // Candidate-only, see .claude/specs/login-with-google.md. Not part of the
  // react-hook-form-driven flow above — GoogleLogin manages its own pending
  // UI, so this only needs the same error state the form already uses.
  async function handleGoogleSuccess(credentialResponse) {
    setError("");
    try {
      const user = await loginWithGoogle(credentialResponse.credential);
      navigate(user.role === "candidate" ? "/dashboard" : "/employer/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function onSubmit(values) {
    setError("");
    try {
      if (mode === "login") {
        const user = await login(values.email, values.password);
        navigate(user.role === "candidate" ? "/dashboard" : "/employer/dashboard");
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

  return (
    <div className="min-h-screen">
      <header className="bg-ink text-white px-6 py-4">
        <Link to="/" className="font-display font-bold text-lg">skillbridge</Link>
      </header>

      <main className="max-w-sm mx-auto px-6 py-10">
        <div className="flex justify-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => setRole("candidate")}
            className={`px-4 py-2 rounded-full text-sm font-medium border ${
              role === "candidate" ? "bg-ink text-white border-ink" : "border-line text-slate"
            }`}
          >
            I'm a candidate
          </button>
          <button
            type="button"
            onClick={() => setRole("employer")}
            className={`px-4 py-2 rounded-full text-sm font-medium border ${
              role === "employer" ? "bg-ink text-white border-ink" : "border-line text-slate"
            }`}
          >
            I'm hiring
          </button>
        </div>

        {error && (
          <div className="bg-danger-bg text-danger text-xs rounded-md px-3 py-2 mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          {mode === "signup" && role === "employer" && (
            <>
              <label htmlFor="company_name" className="text-xs uppercase tracking-wide text-slate font-semibold">Company name</label>
              <input
                id="company_name"
                placeholder="Acme Software"
                className="w-full border border-line rounded-md px-3 py-2 text-sm mt-1.5 mb-3 bg-surface"
                {...register("company_name", { required: "Company name is required", validate: NOT_BLANK })}
              />
              {errors.company_name && <p className="text-danger text-xs mb-2">{errors.company_name.message}</p>}
            </>
          )}

          {mode === "signup" && (
            <>
              <label htmlFor="full_name" className="text-xs uppercase tracking-wide text-slate font-semibold">
                {role === "employer" ? "Your full name" : "Full name"}
              </label>
              <input
                id="full_name"
                placeholder="Jane Doe"
                className="w-full border border-line rounded-md px-3 py-2 text-sm mt-1.5 mb-3 bg-surface"
                {...register("full_name", { required: "Full name is required", validate: NOT_BLANK })}
              />
              {errors.full_name && <p className="text-danger text-xs mb-2">{errors.full_name.message}</p>}
            </>
          )}

          <label htmlFor="email" className="text-xs uppercase tracking-wide text-slate font-semibold">
            {mode === "signup" && role === "employer" ? "Work email" : "Email"}
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="w-full border border-line rounded-md px-3 py-2 text-sm mt-1.5 mb-3 bg-surface"
            {...register("email", {
              required: "Email is required",
              pattern: { value: EMAIL_PATTERN, message: "Enter a valid email address" },
            })}
          />
          {errors.email && <p className="text-danger text-xs mb-2">{errors.email.message}</p>}

          {mode === "signup" && role === "candidate" && (
            <>
              <label htmlFor="phone" className="text-xs uppercase tracking-wide text-slate font-semibold">Phone</label>
              <input
                id="phone"
                type="tel"
                placeholder="03XX-XXXXXXX"
                className="w-full border border-line rounded-md px-3 py-2 text-sm mt-1.5 mb-3 bg-surface"
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

          <label htmlFor="password" className="text-xs uppercase tracking-wide text-slate font-semibold">Password</label>
          <input
            id="password"
            type="password"
            placeholder="********"
            className="w-full border border-line rounded-md px-3 py-2 text-sm mt-1.5 mb-1 bg-surface"
            {...register("password", { required: "Password is required", minLength: { value: 8, message: "Password must be at least 8 characters" } })}
          />
          {errors.password && (
            <p className="text-danger text-xs mb-2">{errors.password.message}</p>
          )}

          {mode === "signup" && (
            <>
              <label htmlFor="confirm_password" className="text-xs uppercase tracking-wide text-slate font-semibold">Confirm password</label>
              <input
                id="confirm_password"
                type="password"
                placeholder="********"
                className="w-full border border-line rounded-md px-3 py-2 text-sm mt-1.5 mb-1 bg-surface"
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

          <Button type="submit" variant="primary" className="w-full mt-3" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : "Continue"}
          </Button>
        </form>

        {role === "candidate" && (
          <>
            <div className="text-center text-xs text-slate my-3">or</div>
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Google sign-in failed. Please try again.")}
              />
            </div>
          </>
        )}

        <div className="text-center text-xs text-slate mt-4">
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
      </main>
    </div>
  );
}
