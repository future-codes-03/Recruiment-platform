import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../../context/AuthContext";
import { signupCandidate } from "../../api/auth";
import Button from "../../components/shared/Button";

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState(searchParams.get("as") === "employer" ? "employer" : "candidate");
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  async function onSubmit(values) {
    setError("");
    try {
      if (mode === "login") {
        const user = await login(values.email, values.password);
        navigate(user.role === "candidate" ? "/dashboard" : "/employer/dashboard");
      } else {
        // Candidate self-signup goes straight through; employer signup is a
        // separate multi-step onboarding flow (company name, industry, etc.)
        // built as its own page — this form only covers the candidate path.
        await signupCandidate({
          email: values.email,
          password: values.password,
          full_name: values.email.split("@")[0], // placeholder until onboarding collects the real name
        });
        navigate("/verify-email");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
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
            onClick={() => setRole("candidate")}
            className={`px-4 py-2 rounded-full text-sm font-medium border ${
              role === "candidate" ? "bg-ink text-white border-ink" : "border-line text-slate"
            }`}
          >
            I'm a candidate
          </button>
          <button
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
          <label className="text-xs uppercase tracking-wide text-slate font-semibold">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full border border-line rounded-md px-3 py-2 text-sm mt-1.5 mb-3 bg-surface"
            {...register("email", { required: true })}
          />
          {errors.email && <p className="text-danger text-xs mb-2">Email is required</p>}

          <label className="text-xs uppercase tracking-wide text-slate font-semibold">Password</label>
          <input
            type="password"
            placeholder="********"
            className="w-full border border-line rounded-md px-3 py-2 text-sm mt-1.5 mb-1 bg-surface"
            {...register("password", { required: true, minLength: 8 })}
          />
          {errors.password && (
            <p className="text-danger text-xs mb-2">Password must be at least 8 characters</p>
          )}

          {mode === "login" && (
            <div className="text-right text-xs text-brass-dark font-medium mb-4">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : "Continue"}
          </Button>
        </form>

        <div className="text-center text-xs text-slate my-3">or</div>
        <Button className="w-full">Continue with Google</Button>

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
