import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { resetPassword } from "../../api/auth";
import { getErrorMessage } from "../../api/errors";
import Button from "../../components/shared/Button";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("form"); // form | saving | success | error
  const [error, setError] = useState("");

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

  return (
    <div className="min-h-screen">
      <header className="bg-ink text-white px-4 sm:px-6 py-4">
        <Link to="/" className="font-display font-bold text-lg">skillbridge</Link>
      </header>

      <main className="max-w-sm mx-auto px-6 py-16 text-center">
        {!token && (
          <>
            <h1 className="font-display text-xl font-semibold mb-2">Missing reset link</h1>
            <p className="text-sm text-slate mb-6">
              This page only works from the link in your password reset email.
            </p>
            <Link to="/forgot-password" className="text-sm font-semibold text-brass-dark hover:underline">
              Request a new link
            </Link>
          </>
        )}

        {token && status === "success" && (
          <>
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-success-bg flex items-center justify-center text-2xl">
              ✓
            </div>
            <h1 className="font-display text-xl font-semibold mb-2 text-success">Password updated</h1>
            <p className="text-sm text-slate">Taking you to login...</p>
          </>
        )}

        {token && status !== "success" && (
          <>
            <h1 className="font-display text-xl font-semibold mb-2 text-left sm:text-center">
              Set a new password
            </h1>

            {error && (
              <div className="bg-danger-bg text-danger text-xs rounded-md px-3 py-2 mb-4 text-left">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="text-left">
              <label className="text-xs uppercase tracking-wide text-slate font-semibold">New password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full border border-line rounded-md px-3 py-2 text-sm mt-1.5 mb-4 bg-surface"
              />

              <label className="text-xs uppercase tracking-wide text-slate font-semibold">Confirm password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="********"
                className="w-full border border-line rounded-md px-3 py-2 text-sm mt-1.5 mb-4 bg-surface"
              />

              <Button type="submit" variant="primary" className="w-full" disabled={status === "saving"}>
                {status === "saving" ? "Saving..." : "Reset password"}
              </Button>
            </form>

            {status === "error" && (
              <Link to="/forgot-password" className="block mt-4 text-sm text-brass-dark font-semibold hover:underline">
                Request a new link
              </Link>
            )}
          </>
        )}
      </main>
    </div>
  );
}
