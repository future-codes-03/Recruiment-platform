import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../api/auth";
import Button from "../../components/shared/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setStatus("sending");
    try {
      await forgotPassword({ email });
      // Same email is shown whether or not the account exists — telling
      // someone "no account with that email" is exactly the kind of thing
      // that lets an attacker discover which emails are registered.
      setStatus("sent");
    } catch {
      setStatus("idle");
      setError("Something went wrong. Try again.");
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-ink text-white px-4 sm:px-6 py-4">
        <Link to="/" className="font-display font-bold text-lg">skillbridge</Link>
      </header>

      <main className="max-w-sm mx-auto px-6 py-16 text-center">
        {status === "sent" ? (
          <>
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-brass-light flex items-center justify-center text-2xl">
              ✉️
            </div>
            <h1 className="font-display text-xl font-semibold mb-2">Check your inbox</h1>
            <p className="text-sm text-slate mb-6">
              If an account exists for <span className="text-ink font-medium">{email}</span>,
              we've sent a link to reset your password.
            </p>
            <Link to="/login" className="text-sm font-semibold text-brass-dark hover:underline">
              Back to login
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold mb-2">Forgot your password?</h1>
            <p className="text-sm text-slate mb-6">
              Enter your email and we'll send you a link to reset it.
            </p>

            {error && (
              <div className="bg-danger-bg text-danger text-xs rounded-md px-3 py-2 mb-4">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="text-left">
              <label className="text-xs uppercase tracking-wide text-slate font-semibold">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-line rounded-md px-3 py-2 text-sm mt-1.5 mb-4 bg-surface"
              />
              <Button type="submit" variant="primary" className="w-full" disabled={status === "sending"}>
                {status === "sending" ? "Sending..." : "Send reset link"}
              </Button>
            </form>

            <Link to="/login" className="block mt-4 text-sm text-slate hover:text-ink">
              Back to login
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
